import { Select } from "@kobalte/core/select";

type OptionsSelectProps<T extends string | number> = {
  ariaLabel: string;
  value: T;
  options: T[];
  getLabel: (value: T) => string;
  onChange: (value: T) => void;
};

export function OptionsSelect<T extends string | number>(
  props: OptionsSelectProps<T>,
) {
  return (
    <Select<T>
      value={props.value}
      disallowEmptySelection
      options={props.options}
      optionValue={(option) => String(option)}
      optionTextValue={(option) => props.getLabel(option)}
      onChange={(next) => {
        if (next !== null && next !== undefined) {
          props.onChange(next);
        }
      }}
      itemComponent={(itemProps) => (
        <Select.Item item={itemProps.item} class="options-kb-select-item">
          <Select.ItemLabel>
            {props.getLabel(itemProps.item.rawValue as T)}
          </Select.ItemLabel>
          <Select.ItemIndicator class="options-kb-select-item-indicator">
            <span class="material-symbols-rounded">done</span>
          </Select.ItemIndicator>
        </Select.Item>
      )}
    >
      <Select.Trigger
        class="options-select options-kb-select-trigger"
        aria-label={props.ariaLabel}
      >
        <Select.Value class="options-kb-select-value">
          {(state) => {
            const selected = state.selectedOption() as T | undefined;
            return props.getLabel(selected ?? props.value);
          }}
        </Select.Value>
        <Select.Icon class="options-kb-select-icon">
          <span class="material-symbols-rounded">expand_more</span>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content class="options-kb-select-content">
          <Select.Listbox class="options-kb-select-listbox" />
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
