let balanceHandler = null;

export function setPointsBalanceHandler(handler) {
  balanceHandler = handler;
}

export function notifyPointsBalance(balance) {
  if (balance != null && balanceHandler) {
    balanceHandler(balance);
  }
}
