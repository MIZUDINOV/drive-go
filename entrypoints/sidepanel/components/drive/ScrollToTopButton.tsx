import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
import { useI18n } from "../../../shared/i18n";

type ScrollToTopButtonProps = {
  /** Whether the button is visible (controls CSS transition) */
  visible: boolean;
  onScrollTop: () => void;
};

export function ScrollToTopButton(props: ScrollToTopButtonProps) {
  const { t } = useI18n();
  return (
    <Tooltip placement="left" gutter={8}>
      <Tooltip.Trigger
        as={Button}
        type="button"
        class={`scroll-to-top-btn${props.visible ? " scroll-to-top-btn--visible" : ""}`}
        aria-label={t("drive.content.scrollTopAria")}
        onClick={props.onScrollTop}
        aria-hidden={!props.visible}
        tabIndex={props.visible ? 0 : -1}
      >
        <span class="material-symbols-rounded" aria-hidden="true">
          arrow_upward
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content class="tab-tooltip">
          <Tooltip.Arrow class="tab-tooltip-arrow" />
          <span>{t("drive.content.scrollTopLabel")}</span>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip>
  );
}
