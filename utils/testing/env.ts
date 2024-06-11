import env from "../env";

export default {
  USE_DEPLOYED_CONTRACTS(defaultValue: boolean = false) {
    return env.bool("TESTING_USE_DEPLOYED_CONTRACTS", defaultValue);
  },
  OPT_L1_NON_REBASABLE_TOKEN() {
    return env.address("TESTING_OPT_L1_NON_REBASABLE_TOKEN");
  },
  OPT_L1_REBASABLE_TOKEN() {
    return env.address("TESTING_OPT_L1_REBASABLE_TOKEN");
  },
  OPT_L1_ACCOUNTING_ORACLE() {
    return env.address("TESTING_OPT_L1_ACCOUNTING_ORACLE");
  },
  OPT_L1_ERC20_TOKEN_BRIDGE() {
    return env.address("TESTING_OPT_L1_ERC20_TOKEN_BRIDGE");
  },

  OPT_L2_TOKEN_RATE_ORACLE() {
    return env.address("TESTING_OPT_L2_TOKEN_RATE_ORACLE");
  },
  OPT_L2_NON_REBASABLE_TOKEN() {
    return env.address("TESTING_OPT_L2_NON_REBASABLE_TOKEN");
  },
  OPT_L2_REBASABLE_TOKEN() {
    return env.address("TESTING_OPT_L2_REBASABLE_TOKEN");
  },
  OPT_L2_ERC20_TOKEN_BRIDGE() {
    return env.address("TESTING_OPT_L2_ERC20_TOKEN_BRIDGE");
  },

  OPT_L1_TOKEN_RATE_NOTIFIER() {
    return env.address("TESTING_OPT_L1_TOKEN_RATE_NOTIFIER");
  },
  OPT_GOV_BRIDGE_EXECUTOR() {
    return env.address("TESTING_OPT_GOV_BRIDGE_EXECUTOR");
  },
  L1_DEV_MULTISIG() {
    return env.address("L1_DEV_MULTISIG");
  },
  L1_TOKENS_HOLDER() {
    return env.address("TESTING_L1_TOKENS_HOLDER");
  },

  TESTING_PRIVATE_KEY() {
    return env.string("TESTING_PRIVATE_KEY");
  },
};
