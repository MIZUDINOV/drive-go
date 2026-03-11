import type {
  TransferDirection,
  TransferQueueItem,
  TransferQueueStatus,
} from "../../shared/transferQueueTypes";

type ClaimTransition = {
  type: "claim";
  direction: TransferDirection;
};

type CancelTransition = {
  type: "cancel";
};

type RetryTransition = {
  type: "retry";
};

type PauseTransition = {
  type: "pause";
};

type FailTransition = {
  type: "fail";
  message: string;
};

type ProgressTransition = {
  type: "progress";
  progressBytes: number;
};

type TransferQueueTransition =
  | ClaimTransition
  | CancelTransition
  | RetryTransition
  | PauseTransition
  | FailTransition
  | ProgressTransition;

function assertAllowed(
  current: TransferQueueStatus,
  allowed: TransferQueueStatus[],
  transitionType: string,
): void {
  if (!allowed.includes(current)) {
    throw new Error(
      `Недопустимый переход ${transitionType} из статуса ${current}`,
    );
  }
}

export function reduceTransferQueueItem(
  current: TransferQueueItem,
  transition: TransferQueueTransition,
): Partial<TransferQueueItem> {
  if (transition.type === "claim") {
    assertAllowed(current.status, ["pending"], transition.type);
    return {
      status: transition.direction === "upload" ? "uploading" : "downloading",
      errorMessage: undefined,
    };
  }

  if (transition.type === "cancel") {
    assertAllowed(current.status, ["pending", "uploading", "downloading"], transition.type);
    return {
      status: "cancelled",
      errorMessage: "Отменено пользователем",
    };
  }

  if (transition.type === "retry") {
    assertAllowed(current.status, ["error", "cancelled"], transition.type);
    return {
      status: "pending",
      progressBytes: 0,
      errorMessage: undefined,
    };
  }

  if (transition.type === "pause") {
    assertAllowed(current.status, ["uploading", "downloading"], transition.type);
    return {
      status: "pending",
      errorMessage: undefined,
    };
  }

  if (transition.type === "fail") {
    assertAllowed(current.status, ["pending", "uploading", "downloading"], transition.type);
    return {
      status: "error",
      errorMessage: transition.message,
    };
  }

  assertAllowed(current.status, ["uploading", "downloading"], transition.type);
  return {
    progressBytes: Math.min(Math.max(0, transition.progressBytes), current.sizeBytes),
  };
}
