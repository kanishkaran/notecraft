import NotesCalendar from "@/components/NotesCalendar";
import { LoginScreen } from "@/components/LoginScreen";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) return <LoginScreen />;
  return (
    <NotesCalendar
      user={{ name: session.user.name ?? null, image: session.user.image ?? null }}
    />
  );
}
