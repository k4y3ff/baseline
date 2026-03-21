interface Props {
  /** Width of the pulse SVG in px. Text scales to match. Default: 120 */
  width?: number
}

/**
 * "baseline" wordmark with teal pulse line — matches the brand asset.
 * The SVG viewBox is 340×20 (original design), scaled via the `width` prop.
 */
export default function AppLogo({ width = 120 }: Props) {
  const svgHeight = Math.round((20 / 340) * width)

  return (
    <div className="flex flex-col items-center" style={{ gap: 5 }}>
      <span
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
          fontSize: Math.round((width / 340) * 52),
          fontWeight: 300,
          letterSpacing: '0.16em',
          color: '#ffffff',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        baseline
      </span>

      <svg
        width={width}
        height={svgHeight}
        viewBox="0 0 340 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,11 L113,11 L129,17 L150,2 L171,11 L340,11"
          stroke="#00C9A7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
