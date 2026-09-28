import Link from 'next/link';
import { SvgIcon } from '@/shared/ui';

/**
 * 시안 주석: "NAVBAR는 그냥 기능 없이 구조만 갖춰주세요"
 * → 메뉴 라벨 4개는 시안대로 모두 표시하되, 실제 라우트가 있는 '스토어'(/)만 링크로 연결한다.
 *   나머지 메뉴는 이동하지 않는 텍스트로 렌더링하고, 장바구니/알림/유저 아이콘도 표시만 한다.
 */
const NAV_ITEMS: ReadonlyArray<{ label: string; href?: string }> = [
  { label: '스토어', href: '/' },
  { label: 'AI OMR WORK' },
  { label: '챌린지' },
  { label: '히든카이스 소개' },
];

function IconBadge({ count }: { count: number }) {
  return (
    <span className="absolute -top-1.5 left-[11px] flex size-[15px] items-center justify-center rounded-full bg-primary text-xs text-white">
      {count}
    </span>
  );
}

export function Gnb({ activeHref = '/' }: { activeHref?: string }) {
  return (
    <header className="flex w-full flex-col items-center bg-white px-4 py-2.5 drop-shadow-[0px_3px_2px_rgba(0,0,0,0.12)]">
      <nav className="flex h-20 w-full max-w-[1280px] items-center justify-between">
        <div className="flex flex-1 items-center gap-[100px]">
          <Link href="/" aria-label="히든카이스 홈">
            <SvgIcon src="/assets/icons/logo-hidden-kice.svg" width={143} height={18} alt="HIDDEN KICE" />
          </Link>
          <ul className="flex items-center gap-8">
            {NAV_ITEMS.map((item) => {
              const className = `text-lg font-semibold ${
                item.href !== undefined && item.href === activeHref ? 'text-primary' : 'text-gray-300'
              }`;
              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link href={item.href} className={className}>
                      {item.label}
                    </Link>
                  ) : (
                    <span className={className}>{item.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex w-[401px] items-center justify-end gap-6">
          <span className="relative block w-[27px]">
            <SvgIcon src="/assets/icons/shopping-cart.svg" width={24} height={24} alt="장바구니" />
            <IconBadge count={1} />
          </span>
          <span className="relative block w-[27px]">
            <SvgIcon src="/assets/icons/bell.svg" width={24} height={24} alt="알림" />
            <IconBadge count={1} />
          </span>
          <span className="block size-6">
            <SvgIcon src="/assets/icons/user.svg" width={24} height={24} alt="내 정보" />
          </span>
        </div>
      </nav>
    </header>
  );
}
