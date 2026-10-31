"use client";

import { useActionState } from "react";
import { savePriceAction, type ActionState } from "@/app/price-actions";
import { FormMessage } from "@/components/booking/FormMessage";

export function PriceForm({ item, parts, prices, description }: { item: number; parts: string[]; prices: number[]; description: string }) {
  const [state, action, pending] = useActionState(savePriceAction, {} as ActionState);
  return (
    <form action={action} className="price-form">
      <input type="hidden" name="item" value={item} />
      <div className="row">
        {parts.map((label, i) => (
          <div key={i} className="field" style={{ margin: 0, flex: "1 1 160px" }}>
            <label htmlFor={`p${item}-${i}`}>{label} (€)</label>
            <input id={`p${item}-${i}`} type="text" inputMode="decimal" name={`price${i}`} defaultValue={(prices[i] / 100).toFixed(2).replace(".", ",")} required />
          </div>
        ))}
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`d${item}`}>Was ist enthalten? <span className="hint">(eine Zeile = ein Punkt)</span></label>
        <textarea id={`d${item}`} name="description" rows={5} defaultValue={description} />
      </div>
      <FormMessage state={state} />
      <button className="btn btn-gold btn-small" type="submit" disabled={pending}>Speichern</button>
    </form>
  );
}
