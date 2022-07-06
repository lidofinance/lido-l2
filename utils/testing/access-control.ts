import { AccessControl } from "../../typechain";

export async function getRoleHolders(
  accessControl: AccessControl,
  role: string,
  fromBlockOrBlockHash?: number | string
) {
  const grantedRolesFilter = accessControl.filters.RoleGranted(role);
  const revokedRolesFilter = accessControl.filters.RoleRevoked(role);

  const roleGrantedEvents = await accessControl.queryFilter(
    grantedRolesFilter,
    fromBlockOrBlockHash
  );
  const roleRevokedEvents = await accessControl.queryFilter(
    revokedRolesFilter,
    fromBlockOrBlockHash
  );
  const sortedEvents = [...roleGrantedEvents, ...roleRevokedEvents].sort(
    (e1, e2) =>
      e1.blockNumber === e2.blockNumber
        ? e1.logIndex - e2.logIndex
        : e1.blockNumber - e2.blockNumber
  );

  const accounts = new Set<string>();
  for (const event of sortedEvents) {
    if (event.event === "RoleGranted") {
      accounts.add(event.args.account);
    } else if (event.event === "RoleRevoked") {
      accounts.delete(event.args.account);
    } else {
      throw new Error(`Unknown event name ${event.event}`);
    }
  }
  return accounts;
}
