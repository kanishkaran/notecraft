#!/usr/bin/env bash
# One-time setup: lets GitHub Actions deploy to ECS without storing AWS keys.
# Run this yourself (not in CI) with an AWS CLI profile that has IAM admin rights.
set -euo pipefail

# ---- fill these in ----
GITHUB_REPO="kanishkaran/notecraft"       # exact case, as it appears in the GitHub URL
GITHUB_BRANCH="main"                      # only this branch will be allowed to assume the role
ROLE_NAME="notecraft-github-deploy"
ECR_REPOSITORY_ARN="arn:aws:ecr:us-east-1:877969058937:repository/kanish/notecraft"
ECS_CLUSTER_ARN="arn:aws:ecs:us-east-1:877969058937:cluster/notecraft-cluster"
ECS_SERVICE_ARN="arn:aws:ecs:us-east-1:877969058937:service/notecraft-cluster/notecraft-service"
TASK_EXECUTION_ROLE_ARN="arn:aws:iam::877969058937:role/notecraft-execution-role"
TASK_ROLE_ARN="arn:aws:iam::877969058937:role/notecraft-task-role"
# ------------------------

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 1. Register GitHub as a trusted OIDC provider (idempotent - skip if it already exists,
#    which is common if you've done this for another repo before).
if aws iam get-open-id-connect-provider \
    --open-id-connect-provider-arn "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" \
    >/dev/null 2>&1; then
  echo "OIDC provider already exists, skipping creation."
else
  aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
  # Note: AWS validates GitHub's OIDC certs against its own trust store, not this literal
  # value, so an outdated thumbprint here won't break anything.
fi

# 2. Trust policy: only THIS repo, only THIS branch, can assume the role.
cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:ref:refs/heads/${GITHUB_BRANCH}" }
    }
  }]
}
EOF

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file:///tmp/trust-policy.json \
  --description "Assumed by GitHub Actions to deploy notecraft to ECS"

# 3. Permissions policy: exactly what the deploy job needs, nothing more.
cat > /tmp/deploy-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:BatchGetImage"
      ],
      "Resource": "${ECR_REPOSITORY_ARN}"
    },
    {
      "Sid": "ECSDeploy",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:UpdateService"
      ],
      "Resource": ["${ECS_CLUSTER_ARN}", "${ECS_SERVICE_ARN}"]
    },
    {
      "Sid": "ECSRegisterTaskDef",
      "Effect": "Allow",
      "Action": "ecs:RegisterTaskDefinition",
      "Resource": "*"
    },
    {
      "Sid": "PassRolesToECS",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": ["${TASK_EXECUTION_ROLE_ARN}", "${TASK_ROLE_ARN}"]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "notecraft-deploy" \
  --policy-document file:///tmp/deploy-policy.json

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
echo ""
echo "Done. Add this as a GitHub Actions secret named AWS_DEPLOY_ROLE_ARN:"
echo "$ROLE_ARN"
