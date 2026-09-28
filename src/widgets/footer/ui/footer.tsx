const POLICY_LINKS = ['회사소개', '이용약관', '개인정보처리방침'] as const;

export function Footer() {
  return (
    <footer className="flex w-full flex-col items-center bg-white px-[60px] py-10">
      <div className="flex w-full max-w-[1320px] flex-col gap-2 text-sm font-medium text-gray-200">
        <div className="flex items-center gap-3">
          {POLICY_LINKS.map((label, index) => (
            <span key={label} className="flex items-center gap-3">
              {index > 0 ? <span aria-hidden>|</span> : null}
              <span>{label}</span>
            </span>
          ))}
        </div>

        <p>
          (주)히든카이스 | 대표: 안영호 | 사업자등록번호: 735-87-02522 (
          <span className="underline">사업자정보확인</span>)
        </p>
        <p>
          주소: 경기도 고양시 일산서구 일현로 97-11, 56F | 통신판매업신고: 제 2024-고양일산서-1209 |
          이메일: Hidden_kice@naver.com
        </p>
        <p>Copyright © 2026 히든카이스. All rights reserved.</p>
      </div>
    </footer>
  );
}
