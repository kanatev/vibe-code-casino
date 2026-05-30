import { fmt } from '../lib/format'
import { TOKEN_SYMBOL } from '../config'

type Props = {
  label: string
  value: string
  onChange: (v: string) => void
  max?: bigint
  disabled?: boolean
}

export function AmountInput({ label, value, onChange, max, disabled }: Props) {
  return (
    <div className="field">
      <div className="between">
        <label>{label}</label>
        {max !== undefined && (
          <span className="muted" style={{ fontSize: 12 }}>
            Available: {fmt(max)} {TOKEN_SYMBOL}
          </span>
        )}
      </div>
      <div className="input-wrap">
        <input
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, '')
            onChange(v)
          }}
        />
        <span className="suffix">{TOKEN_SYMBOL}</span>
        {max !== undefined && (
          <button
            type="button"
            className="input-max"
            disabled={disabled}
            onClick={() => onChange(fmt(max, 6).replace(/,/g, ''))}
          >
            MAX
          </button>
        )}
      </div>
    </div>
  )
}
