export interface LanguageOption {
  code: string;
  labelDe: string;
  nativeLabel: string;
  rtl: boolean;
}

export function LanguagePicker({ languages, defaultValue }: { languages: LanguageOption[]; defaultValue?: string }) {
  return (
    <div className="lang-grid" role="radiogroup" aria-label="Sprache wählen">
      {languages.map((l) => (
        <label key={l.code} className="choice">
          <input type="radio" name="language" value={l.code} defaultChecked={defaultValue === l.code} />
          <span>
            <strong className="lang-native" lang={l.code} dir={l.rtl ? "rtl" : "ltr"}>{l.nativeLabel}</strong>
            <span className="hint">{l.labelDe}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
