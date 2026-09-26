import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui';
import PublicLayout from '@/components/navigation/public-chrome';

export default function NotFoundPage() {
  const { pathname } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <PublicLayout>
      <section className="px-2.5 pt-2.5 sm:px-[18px]">
        <div className="relative mx-auto flex min-h-[62vh] max-w-page flex-col items-center justify-center overflow-hidden rounded-r28 bg-hero px-6 py-20 text-center">
          <div className="cloud -bottom-[18%] left-[10%] h-[50%] w-[80%] blur-[10px]" />
          <div className="relative">
            <p className="mono-label text-white/80">Error 404 · Page not found</p>
            <h1 className="mt-5 text-[clamp(56px,11vw,140px)] font-medium leading-[0.9] tracking-display text-white">
              Off script.
            </h1>
            <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-[#EAF4FF]">
              We couldn’t find <span className="break-all font-mono text-[14px] text-white">{pathname}</span>. It may have moved, or the link is out of date.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-2.5">
              <Button to={isAuthenticated ? '/dashboard' : '/'} variant="lime" cta className="py-[6px]">
                {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
              </Button>
              {!isAuthenticated && (
                <Button to="/login" variant="glass" size="lg">
                  Log in
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
