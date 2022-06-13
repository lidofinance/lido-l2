import { BridgingManager } from "../typechain";

interface ManagersData {
  depositEnablers?: string[];
  depositDisablers?: string[];
  withdrawalsEnablers?: string[];
  withdrawalsDisablers?: string[];
}
export default {
  async grantRoles(bridgingManager: BridgingManager, managers: ManagersData) {
    const roles = {
      DEPOSITS_ENABLER_ROLE: await bridgingManager.DEPOSITS_ENABLER_ROLE(),
      DEPOSITS_DISABLER_ROLE: await bridgingManager.DEPOSITS_DISABLER_ROLE(),
      WITHDRAWALS_ENABLER_ROLE:
        await bridgingManager.WITHDRAWALS_ENABLER_ROLE(),
      WITHDRAWALS_DISABLER_ROLE:
        await bridgingManager.WITHDRAWALS_DISABLER_ROLE(),
    };

    for (const depositsEnabler of managers.depositEnablers || []) {
      await bridgingManager.grantRole(
        roles.DEPOSITS_ENABLER_ROLE,
        depositsEnabler
      );
    }

    for (const depositsDisabler of managers.depositDisablers || []) {
      await bridgingManager.grantRole(
        roles.DEPOSITS_DISABLER_ROLE,
        depositsDisabler
      );
    }

    for (const withdrawalsEnabler of managers.withdrawalsEnablers || []) {
      await bridgingManager.grantRole(
        roles.WITHDRAWALS_ENABLER_ROLE,
        withdrawalsEnabler
      );
    }

    for (const withdrawalsDisabler of managers.withdrawalsDisablers || []) {
      await bridgingManager.grantRole(
        roles.WITHDRAWALS_DISABLER_ROLE,
        withdrawalsDisabler
      );
    }
  },

  async activate(bridgingManager: BridgingManager) {
    await bridgingManager.enableDeposits();
    await bridgingManager.enableWithdrawals();
  },
};
