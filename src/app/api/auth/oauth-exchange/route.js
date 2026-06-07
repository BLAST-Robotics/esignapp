import { auth } from '@/lib/auth.config';
import { createUser, createUserSession, findUserByEmail, initAuthTable, normEmail } from '@/lib/auth';

export async function GET() {
  try {
    await initAuthTable();

    const session = await auth();
    if (!session?.user?.email) {
      return Response.redirect(new URL('/admin?oauth_error=no_session', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
    }

    const email = normEmail(session.user.email);
    let user = await findUserByEmail(email);

    if (!user) {
      const userId = await createUser({
        email,
        password: 'oauth:google',
        name: session.user.name || email.split('@')[0],
        role: 'user',
      });
      user = { id: userId, email, name: session.user.name || email.split('@')[0], role: 'user' };
    }

    const token = await createUserSession(user.id);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return Response.redirect(new URL(`/admin?oauth_token=${token}`, baseUrl));
  } catch (error) {
    console.error('OAuth exchange error:', error);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return Response.redirect(new URL('/admin?oauth_error=exchange_failed', baseUrl));
  }
}
