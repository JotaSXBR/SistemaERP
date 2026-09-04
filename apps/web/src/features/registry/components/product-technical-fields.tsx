import type { ProductAttributeDefinitionDto } from "@sistema-erp/contracts";
import type { UseFormRegister } from "react-hook-form";

import { toInches } from "../measure.js";

/**
 * As oito medidas da ADR-0010, na ordem em que fazem sentido para quem cadastra: primeiro o que
 * define a seção da peça, depois o comprimento e por último os pesos teóricos.
 */
export const GEOMETRY_FIELDS = [
  { label: "Espessura", name: "thicknessMm", unit: "mm" },
  { label: "Largura", name: "widthMm", unit: "mm" },
  { label: "Altura", name: "heightMm", unit: "mm" },
  { label: "Diâmetro externo", name: "outerDiameterMm", unit: "mm" },
  { label: "Diâmetro interno", name: "innerDiameterMm", unit: "mm" },
  { label: "Comprimento", name: "lengthMm", unit: "mm" },
  { label: "Peso por metro", name: "weightPerMeterKg", unit: "kg/m" },
  { label: "Peso por metro quadrado", name: "weightPerSquareMeterKg", unit: "kg/m²" },
] as const;

export type GeometryFieldName = (typeof GEOMETRY_FIELDS)[number]["name"];

type TechnicalForm = {
  attributes: Record<string, string>;
  geometry: Record<GeometryFieldName, string>;
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-950";

export function ProductGeometryFields({
  disabled,
  invalid,
  register,
  values,
}: {
  disabled: boolean;
  invalid: Partial<Record<GeometryFieldName, boolean>>;
  register: UseFormRegister<TechnicalForm>;
  /** Os valores em edição, só para mostrar o equivalente em polegada ao lado do campo. */
  values: Record<GeometryFieldName, string>;
}) {
  return (
    <section className="mt-6">
      <p className="text-xs font-semibold text-ink-500 uppercase">Geometria</p>
      <p className="mt-2 text-xs leading-5 text-ink-500">
        Medidas em milímetro e pesos em quilograma. Deixe em branco o que não se aplica ao produto —
        em branco não é zero.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {GEOMETRY_FIELDS.map((field) => {
          const inches = field.unit === "mm" ? toInches(values[field.name]) : undefined;

          return (
            <div key={field.name}>
              <label className="block text-sm font-medium" htmlFor={`product-${field.name}`}>
                {field.label} <span className="font-normal text-ink-500">({field.unit})</span>
              </label>
              <input
                aria-describedby={invalid[field.name] ? `product-${field.name}-error` : undefined}
                aria-invalid={invalid[field.name] ? true : undefined}
                className={fieldClass}
                disabled={disabled}
                id={`product-${field.name}`}
                inputMode="decimal"
                {...register(`geometry.${field.name}`)}
              />
              {invalid[field.name] ? (
                <p className="mt-2 text-sm text-alert-600" id={`product-${field.name}-error`}>
                  Informe um número maior que zero, ou deixe em branco.
                </p>
              ) : inches ? (
                // Polegada é apresentação, nunca cadastro: o que vai para o banco é o milímetro.
                <p className="mt-2 text-xs text-ink-500">≈ {inches}″</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ProductAttributeFields({
  definitions,
  disabled,
  register,
}: {
  definitions: ProductAttributeDefinitionDto[];
  disabled: boolean;
  register: UseFormRegister<TechnicalForm>;
}) {
  return (
    <section className="mt-6">
      <p className="text-xs font-semibold text-ink-500 uppercase">Classificação técnica</p>

      {definitions.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-ink-500">
          Nenhum eixo cadastrado. Eixos como liga, processo ou têmpera são criados no cadastro de
          atributos, sem alteração de sistema.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {definitions.map((definition) => (
            <div key={definition.id}>
              <label
                className="block text-sm font-medium"
                htmlFor={`product-axis-${definition.id}`}
              >
                {definition.name}
              </label>
              <select
                className={fieldClass}
                disabled={disabled}
                id={`product-axis-${definition.id}`}
                {...register(`attributes.${definition.id}`)}
              >
                <option value="">Não classificado</option>
                {definition.options
                  .filter((option) => option.active)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
