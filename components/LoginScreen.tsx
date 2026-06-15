import { signIn } from "@/auth";

export function LoginScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", color: "#e8e6e1",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=Playfair+Display:wght@400;500&display=swap');
        .google-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px 20px; border-radius: 10px;
          border: 1px solid rgba(200,170,110,0.3);
          background: linear-gradient(135deg, rgba(200,170,110,0.15), rgba(200,170,110,0.05));
          color: #c8aa6e; font-size: 14px; font-weight: 500; cursor: pointer;
          font-family: 'DM Sans', sans-serif; letter-spacing: 0.3px;
          transition: all 0.25s ease;
        }
        .google-btn:hover {
          background: linear-gradient(135deg, rgba(200,170,110,0.25), rgba(200,170,110,0.1));
          border-color: rgba(200,170,110,0.5);
        }
      `}</style>
      <div style={{
        width: "100%", maxWidth: 380, textAlign: "center",
        background: "linear-gradient(170deg, rgba(26,26,36,0.6), rgba(13,13,19,0.8))",
        border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
        padding: "44px 36px", boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: "0 auto 18px",
          background: "linear-gradient(135deg, #c8aa6e, #8a7340)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, color: "#0a0a0f",
        }}>N</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 400, marginBottom: 8 }}>
          Notecraft
        </h1>
        <p style={{ fontSize: 13, color: "#8a8690", marginBottom: 30, lineHeight: 1.6 }}>
          Your private journal. Sign in to see your entries.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button type="submit" className="google-btn">
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
