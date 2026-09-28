import type { ReactNode } from 'react';
import { Gnb } from '@/widgets/gnb';
import { Footer } from '@/widgets/footer';

/**
 * 모든 화면이 공유하는 뼈대. 라우트 파일이 위젯을 직접 import 하지 않도록
 * app 레이어에서 한 번 감싼다.
 */
export function SiteShell({ children, activeHref }: { children: ReactNode; activeHref?: string }) {
  return (
    <div className="flex min-h-full flex-col">
      <Gnb activeHref={activeHref} />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
