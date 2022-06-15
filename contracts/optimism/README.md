## `ERC20Metadata`

Contains optional methods for the `ERC20` tokens. It uses the UnstructuredStorage pattern to store strings with name and symbol info. Might be used with the upgradable proxies.

### Variables

Contract declares `public` and `immutable` variable **`decimals`** of type `uint8`.

The `name` and `symbol` info are stored in the structure:

```solidity=
struct DynamicMetadata {
    string name;
    string symbol;
}
```

### Funcations

#### `name()`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Mutability:** &nbsp; `view` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(string memory)`

Returns the name of the token.

#### `symbol()`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Mutability:** &nbsp; `view` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(string memory)`

Returns the symbol of the token.

#### `_setERC20MetadataName(string memory)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `internal` >**Arguments:**
>
> - **`name_`** - string with name of the token

Sets the `name` of the token. Might be called only when the `name` is empty.

#### `_setERC20MetadataSymbol(string memory)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `internal` >**Arguments:**
>
> - **`symbol_`** - string with symbol of the token

Sets the `symbol` of the token. Might be called only when the `symbol` is empty.

#### `_loadDynamicMetadata()`

> **Visibility:** &nbsp;&nbsp;&nbsp; `private` >**Mutability:** &nbsp; `pure` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(DynamicMetadata storage r)`

Returns the reference to the slot with `DynamicMetadta` struct

## `ERC20Core`

- **Implements:** [`@openzeppelin/IERC20`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/d4fb3a89f9d0a39c7ee6f2601d33ffbf30085322/contracts/token/ERC20/IERC20.sol)

Contains the required variables and logic of the `ERC20` token. The contract is a slightly modified version of the [`ERC20`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/d4fb3a89f9d0a39c7ee6f2601d33ffbf30085322/contracts/token/ERC20/ERC20.sol) contract from the OpenZeppelin package.

### Variables

Contract declares the following variables to store state of the token:

- **`uint256 public totalSupply`** - the total supply of the token
- **`mapping(address => uint256) public balanceOf`** - stores balances of the token holders
- **`mapping(address => mapping(address => uint256)) public allowance`** - stores allowances of the token holders

### Functions

#### `approve(address,uint256)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(bool)` >**Arguments:**
>
> - **`spender_`** - an address of the tokens spender
> - **`amount_`** - a number of tokens to allow to spend
>
> **Emits:** `Approval(address indexed owner, address indexed spender, uint256 value)`

Allows _spender to withdraw from the `msg.sender` account multiple times, up to the `amount_`. If this function is called again it overwrites the current allowance with `amount\_`. Returns a `bool` value indicating whether the operation succeeded.

#### `transfer(address,uint256)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(bool)` >**Arguments:**
>
> - **`to_`** - an address of the recipient of the tokens
> - **`amount_`** - a number of tokens to transfer
>
> **Emits:** `Transfer(address indexed from, address indexed to, uint256 value)`

Transfers `amount` of tokens from sender to `to` account.
Returns a `bool` value indicating whether the operation succeeded.

#### `transferFrom(address,address,uint256)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(bool)` >**Arguments:**
>
> - **`from_`** - an address to transfer tokens from
> - **`to_`** - an address of the recipient of the tokens
> - **`amount_`** - a number of tokens to transfer
>
> **Emits:** `Transfer(address indexed from, address indexed to, uint256 value)` `Approval(address indexed owner, address indexed spender, uint256 value)`

Transfers `amount` of token from the `from_` account to `to_` using the allowance mechanism. `amount_` is then deducted from the caller's allowance. Returns a `bool` value indicating whether the operation succeed.

#### `increaseAllowance(address,uint256)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(bool)` >**Arguments:**
>
> - **`spender_`** - an address of the tokens spender
> - **`addedValue_`** - a number to increase allowance
>
> **Emits:** `Approval(address indexed owner, address indexed spender, uint256 value)`

Atomically increases the allowance granted to `spender` by the caller. Returns a `bool` value indicating whether the operation succeed.

#### `decreaseAllowance(address,uint256)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(bool)` >**Arguments:**
>
> - **`spender_`** - an address of the tokens spender
> - **`subtractedValue_`** - a number to decrease allowance
>
> **Emits:** `Approval(address indexed owner, address indexed spender, uint256 value)`

Atomically decreases the allowance granted to `spender` by the caller. Returns a `bool` value indicating whether the operation succeed.

## `ERC20Ownable`

**Implements:** [`IERC20Ownable`]()
**Inherits:** [`ERC20Metadata`](#ERC20Metadata) [`ERC20Core`](#ERC20CoreLogic)

Inherits the `ERC20` default functionality that allows the owner to mint and burn tokens.

### Variables

Contract declares an immutable variable **`owner`**, which stores the address of the owner of the token.

### Functions

#### `mint(address,uint256)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Modifiers:** &nbsp;&nbsp; [`onlyOwner`]() >**Arguments:**
>
> - **`account_`** - an address of the tokens recipient
> - **`amount_`** - a number to mint
>
> **Emits:** `Transfer(address indexed from, address indexed to, uint256 value)`

Mints the `amount_` of tokens to the `account_`. The method might be called only by the owner of the token. Reverts with the error `ErrorNotOwner()` when called not by owner.

#### `burn(address,uint256)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Modifiers:** &nbsp;&nbsp; [`onlyOwner`]() >**Arguments:**
>
> - **`account_`** - an address of the tokens recipient
> - **`amount_`** - a number to burn
>
> **Emits:** `Transfer(address indexed from, address indexed to, uint256 value)`

Destroys the `amount_` of tokens from the `account_`. The method might be called only by the owner of the token. Reverts with the error `ErrorNotOwner()` when called not by owner.

### Modifiers

#### `onlyOwner()`

Validates that the `msg.sender` of the method is the `owner`. Reverts with error `ErrorNotOwner()` in other cases.

## `OssifiableProxy`

- **Inherits:** [`@openzeppelin/ERC1967Proxy`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/d4fb3a89f9d0a39c7ee6f2601d33ffbf30085322/contracts/proxy/ERC1967/ERC1967Proxy.sol)

Extends the [`ERC1967Proxy`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/d4fb3a89f9d0a39c7ee6f2601d33ffbf30085322/contracts/proxy/ERC1967/ERC1967Proxy.sol) contract from the OpenZeppelin package and adds some admin methods. In contrast to [`UUPSUpgradableProxy`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/d4fb3a89f9d0a39c7ee6f2601d33ffbf30085322/contracts/proxy/utils/UUPSUpgradeable.sol), it doesn't increase the inheritance chain of the implementation contracts. And allows saving one extra `SLOAD` operation on every user request in contrast to [`TransparentUpgradeableProxy`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/d4fb3a89f9d0a39c7ee6f2601d33ffbf30085322/contracts/proxy/transparent/TransparentUpgradeableProxy.sol). But adding any external methods to the `ERC1967Proxy` creates the risk of selectors clashing, as described in the OpenZepplin [proxies docs](https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies#transparent-proxies-and-function-clashes). To avoid the risk of clashing, the implementation upgrade process must contain a step with a search of the collisions between proxy and implementation.

### Functions

#### `proxy__getAdmin()`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Mutability:** &nbsp; `view` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(address)`

Returns the admin of the proxy.

#### `proxy__getImplementation()`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Mutability:** &nbsp; `view` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(address)`

Returns the address of the implementation.

#### `proxy__getIsOssified()`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Mutability:** &nbsp; `view` >**Returns** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `(bool)`

Returns whether the proxy is ossified or not.

#### `proxy__ossify()`

> **Visibility:** &nbsp; &nbsp; `external` >**Modifiers:** &nbsp;&nbsp; [`onlyAdmin`](#onlyAdmin) [`whenNotOssified`](#whenNotOssified) >**Emits:** &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; `AdminChanged(address previousAdmin, address newAdmin)`

Allows to transfer admin rights to zero address and prevent future upgrades of the proxy.

#### `proxy__changeAdmin(address)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Modifiers:** &nbsp;&nbsp; [`onlyAdmin`](#onlyAdmin) [`whenNotOssified`](#whenNotOssified) >**Arguments:**
>
> - **`newAdmin_`** - an address of the new admin. Must not be zero address.
>
> **Emits:** `AdminChanged(address previousAdmin, address newAdmin)`

Changes the admin of the proxy. Reverts with message "ERC1967: new admin is the zero address" if `newAdmin_` is zero address.

#### `proxy__upgradeTo(address)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Modifiers:** &nbsp;&nbsp; [`onlyAdmin`](#onlyAdmin) [`whenNotOssified`](#whenNotOssified) >**Arguments:**
>
> - **`newImplementation_`** - an address of the new implementation. Must be a contract.
>
> **Emits:** `Upgraded(address indexed implementation)`

Upgrades the implementation of the proxy. Reverts with the error "ERC1967: new implementation is not a contract" if the `newImplementation_` is not a contract.

#### `proxy__upgradeToAndCall(address,bytes memory,bool)`

> **Visibility:** &nbsp;&nbsp;&nbsp; `external` >**Modifiers:** &nbsp;&nbsp; [`onlyAdmin`](#onlyAdmin) [`whenNotOssified`](#whenNotOssified) >**Arguments:**
>
> - **`newImplementation_`** - an address of the new implementation. Must be a contract.
> - **`setupCalldata_`** - a data to pass into setup call after implementation upgrade.
> - **`forceCall_`** - forces make delegate call to the implementation even with empty `setupCalldata_`
>
> **Emits:** `Upgraded(address indexed implementation)`

Upgrades the implementation of the proxy with an additional setup call. Reverts with the error "ERC1967: new implementation is not a contract" if the `newImplementation_` is not a contract. If `setupCalldata_.length` equals zero setup step will be skipped, if forceCall is false.

### Modifiers

#### `whenNotOssified()`

Validates that proxy is not ossified. Reverts with error `ErrorProxyIsOssified()` when called on ossified contract.

#### `onlyAdmin()`

Validates that method is called by the admin of the proxy. Reverts with error `ErrorNotAdmin()` when called not by admin.
