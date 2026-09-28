import OtpLoginForm from '../../components/auth/OtpLoginForm';

export const metadata = {
  title: 'ورود | Toy Store',
  description: 'ورود با کد تأیید پیامکی',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <OtpLoginForm />
    </main>
  );
}
