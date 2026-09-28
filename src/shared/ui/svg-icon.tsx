/* eslint-disable @next/next/no-img-element -- Figma에서 받은 SVG는 루트의 width/height 를 그대로 써야 하므로 next/image 로 감싸지 않는다 */
type SvgIconProps = {
  /** public 기준 경로. 예: /assets/icons/bell.svg */
  src: string;
  /** Figma SVG 루트의 width 값 */
  width: number;
  /** Figma SVG 루트의 height 값 */
  height: number;
  alt?: string;
  className?: string;
};

/**
 * 시안에서 내려받은 정적 SVG를 원본 크기 그대로 렌더링한다.
 * 크기를 바꿔야 하는 곳에서는 wrapper 로 감싸고 이 컴포넌트의 width/height 는 건드리지 않는다.
 */
export function SvgIcon({ src, width, height, alt = '', className }: SvgIconProps) {
  return <img src={src} width={width} height={height} alt={alt} className={className} aria-hidden={alt === ''} />;
}
