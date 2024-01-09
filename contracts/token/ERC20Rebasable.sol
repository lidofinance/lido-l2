// SPDX-FileCopyrightText: 2022 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Wrapable} from "./interfaces/IERC20Wrapable.sol";
import {IERC20BridgedShares} from "./interfaces/IERC20BridgedShares.sol";
import {ITokenRateOracle} from "./interfaces/ITokenRateOracle.sol";
import {ERC20Metadata} from "./ERC20Metadata.sol";

/// @author kovalgek
/// @notice Extends the ERC20Shared functionality
contract ERC20Rebasable is IERC20, IERC20Wrapable, IERC20BridgedShares, ERC20Metadata {

    error ErrorZeroSharesWrap();
    error ErrorZeroTokensUnwrap();
    error ErrorInvalidRateDecimals(uint8);
    error ErrorWrongOracleUpdateTime();
    error ErrorOracleAnswerIsNegative();
    error ErrorTrasferToRebasableContract();
    error ErrorNotEnoughBalance();
    error ErrorNotEnoughAllowance();
    error ErrorAccountIsZeroAddress();
    error ErrorDecreasedAllowanceBelowZero();
    error ErrorNotBridge();
    error ErrorERC20Transfer();

    /// @inheritdoc IERC20BridgedShares
    address public immutable bridge;

    /// @notice Contract of non-rebasable token to wrap.
    IERC20 public immutable wrappedToken;

    /// @notice Oracle contract used to get token rate for wrapping/unwrapping tokens.
    ITokenRateOracle public immutable tokenRateOracle;
    
    /// @inheritdoc IERC20
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Basic unit representing the token holder's share in the total amount of ether controlled by the protocol.
    mapping (address => uint256) private shares;

    /// @notice The total amount of shares in existence.
    uint256 private totalShares;

    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    /// @param decimals_ The decimals places of the token
    /// @param wrappedToken_ address of the ERC20 token to wrap
    /// @param tokenRateOracle_ address of oracle that returns tokens rate
    /// @param bridge_ The bridge address which allowd to mint/burn tokens
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address wrappedToken_,
        address tokenRateOracle_,
        address bridge_
    ) ERC20Metadata(name_, symbol_, decimals_) {
        wrappedToken = IERC20(wrappedToken_);
        tokenRateOracle = ITokenRateOracle(tokenRateOracle_);
        bridge = bridge_;
    }

    /// @notice Sets the name and the symbol of the tokens if they both are empty
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    function initialize(string memory name_, string memory symbol_) external {
        _setERC20MetadataName(name_);
        _setERC20MetadataSymbol(symbol_);
    }

    /// @inheritdoc IERC20Wrapable
    function wrap(uint256 sharesAmount_) external returns (uint256) {
        if (sharesAmount_ == 0) revert ErrorZeroSharesWrap();
    
        _mintShares(msg.sender, sharesAmount_);
        if(!wrappedToken.transferFrom(msg.sender, address(this), sharesAmount_)) revert ErrorERC20Transfer();

        return _getTokensByShares(sharesAmount_);
    }

    /// @inheritdoc IERC20Wrapable
    function unwrap(uint256 tokenAmount_) external returns (uint256) {
        if (tokenAmount_ == 0) revert ErrorZeroTokensUnwrap();

        uint256 sharesAmount = _getSharesByTokens(tokenAmount_);
        _burnShares(msg.sender, sharesAmount);
        if(!wrappedToken.transfer(msg.sender, sharesAmount)) revert ErrorERC20Transfer();

        return sharesAmount;
    }

    /// @inheritdoc IERC20Wrapable
    function stETHPerToken() external view returns (uint256) {
        return uint256(tokenRateOracle.latestAnswer());
    }

    /// @inheritdoc IERC20BridgedShares
    function mintShares(address account_, uint256 amount_) external onlyBridge returns (uint256) {
        return _mintShares(account_, amount_);
    }

    /// @inheritdoc IERC20BridgedShares
    function burnShares(address account_, uint256 amount_) external onlyBridge {
        _burnShares(account_, amount_);
    }

    /// @dev Validates that sender of the transaction is the bridge
    modifier onlyBridge() {
        if (msg.sender != bridge) {
            revert ErrorNotBridge();
        }
        _;
    }

    /// @inheritdoc IERC20
    function totalSupply() external view returns (uint256) {
        return _getTokensByShares(totalShares);
    }

    /// @inheritdoc IERC20
    function balanceOf(address account_) external view returns (uint256) {
        return _getTokensByShares(_sharesOf(account_));
    }

    /// @inheritdoc IERC20
    function approve(address spender_, uint256 amount_)
        external
        returns (bool)
    {
        _approve(msg.sender, spender_, amount_);
        return true;
    }

    /// @inheritdoc IERC20
    function transfer(address to_, uint256 amount_) external returns (bool) {
        _transfer(msg.sender, to_, amount_);
        return true;
    }

    /// @inheritdoc IERC20
    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    ) external returns (bool) {
        _spendAllowance(from_, msg.sender, amount_);
        _transfer(from_, to_, amount_);
        return true;
    }

    /// @notice Atomically increases the allowance granted to spender by the caller.
    /// @param spender_ An address of the tokens spender
    /// @param addedValue_ An amount to increase the allowance
    function increaseAllowance(address spender_, uint256 addedValue_)
        external
        returns (bool)
    {
        _approve(
            msg.sender,
            spender_,
            allowance[msg.sender][spender_] + addedValue_
        );
        return true;
    }

    /// @notice Atomically decreases the allowance granted to spender by the caller.
    /// @param spender_ An address of the tokens spender
    /// @param subtractedValue_ An amount to decrease the  allowance
    function decreaseAllowance(address spender_, uint256 subtractedValue_)
        external
        returns (bool)
    {
        uint256 currentAllowance = allowance[msg.sender][spender_];
        if (currentAllowance < subtractedValue_) {
            revert ErrorDecreasedAllowanceBelowZero();
        }
        unchecked {
            _approve(msg.sender, spender_, currentAllowance - subtractedValue_);
        }
        return true;
    }

    /// @dev Moves amount_ of tokens from sender_ to recipient_
    /// @param from_ An address of the sender of the tokens
    /// @param to_  An address of the recipient of the tokens
    /// @param amount_ An amount of tokens to transfer
    function _transfer(
        address from_,
        address to_,
        uint256 amount_
    ) internal onlyNonZeroAccount(from_) onlyNonZeroAccount(to_) {
        uint256 sharesToTransfer = _getSharesByTokens(amount_);
        _transferShares(from_, to_, sharesToTransfer);
        emit Transfer(from_, to_, amount_);
    }

    /// @dev Updates owner_'s allowance for spender_ based on spent amount_. Does not update
    ///     the allowance amount in case of infinite allowance
    /// @param owner_ An address of the account to spend allowance
    /// @param spender_  An address of the spender of the tokens
    /// @param amount_ An amount of allowance spend
    function _spendAllowance(
        address owner_,
        address spender_,
        uint256 amount_
    ) internal {
        uint256 currentAllowance = allowance[owner_][spender_];
        if (currentAllowance == type(uint256).max) {
            return;
        }
        if (amount_ > currentAllowance) {
            revert ErrorNotEnoughAllowance();
        }
        unchecked {
            _approve(owner_, spender_, currentAllowance - amount_);
        }
    }

    /// @dev Sets amount_ as the allowance of spender_ over the owner_'s tokens
    /// @param owner_ An address of the account to set allowance
    /// @param spender_  An address of the tokens spender
    /// @param amount_ An amount of tokens to allow to spend
    function _approve(
        address owner_,
        address spender_,
        uint256 amount_
    ) internal virtual onlyNonZeroAccount(owner_) onlyNonZeroAccount(spender_) {
        allowance[owner_][spender_] = amount_;
        emit Approval(owner_, spender_, amount_);
    }

    /// @notice Get shares amount of the provided account.
    /// @param account_ provided account address.
    /// @return amount of shares owned by `_account`.
    function sharesOf(address account_) external view returns (uint256) {
        return _sharesOf(account_);
    }

    /// @return total amount of shares.
    function getTotalShares() external view returns (uint256) {
        return _getTotalShares();
    }

    /// @notice Get amount of tokens for a given amount of shares.
    /// @param sharesAmount_ amount of shares.
    /// @return amount of tokens for a given shares amount.
    function getTokensByShares(uint256 sharesAmount_) external view returns (uint256) {
        return _getTokensByShares(sharesAmount_);
    }

    /// @notice Get amount of shares for a given amount of tokens.
    /// @param tokenAmount_ provided tokens amount.
    /// @return amount of shares for a given tokens amount.
    function getSharesByTokens(uint256 tokenAmount_) external view returns (uint256) {
        return _getSharesByTokens(tokenAmount_);
    }

    function _sharesOf(address account_) internal view returns (uint256) {
        return shares[account_];
    }

    function _getTotalShares() internal view returns (uint256) {
        return totalShares;
    }

    function _getTokensByShares(uint256 sharesAmount_) internal view returns (uint256) {
        (uint256 tokensRate, uint256 decimals)  = _getTokensRateAndDecimal();
        return (sharesAmount_ * tokensRate) / (10 ** decimals);
    }

    function _getSharesByTokens(uint256 tokenAmount_) internal view returns (uint256) {
        (uint256 tokensRate, uint256 decimals)  = _getTokensRateAndDecimal();
        return (tokenAmount_ * (10 ** decimals)) / tokensRate;
    }

    function _getTokensRateAndDecimal() internal view returns (uint256, uint256) {
        uint8 rateDecimals = tokenRateOracle.decimals();

        if (rateDecimals == uint8(0) || rateDecimals > uint8(18)) revert ErrorInvalidRateDecimals(rateDecimals);

        //slither-disable-next-line unused-return
        (,
        int256 answer
        ,
        ,
        uint256 updatedAt
        ,) = tokenRateOracle.latestRoundData();

        if (updatedAt == 0) revert ErrorWrongOracleUpdateTime();
        if (answer <= 0) revert ErrorOracleAnswerIsNegative();

        return (uint256(answer), uint256(rateDecimals));
    }

    /// @dev Creates amount_ shares and assigns them to account_, increasing the total shares supply
    /// @param recipient_ An address of the account to mint shares
    /// @param amount_ An amount of shares to mint
    function _mintShares(
        address recipient_,
        uint256 amount_
    ) internal onlyNonZeroAccount(recipient_) returns (uint256)  {
        totalShares = totalShares + amount_;
        shares[recipient_] = shares[recipient_] + amount_;
        emit Transfer(address(0), recipient_, amount_);
        return totalShares;
    }

    /// @dev Destroys amount_ shares from account_, reducing the total shares supply.
    /// @param account_ An address of the account to mint shares
    /// @param amount_ An amount of shares to mint
    function _burnShares(
        address account_,
        uint256 amount_
    ) internal onlyNonZeroAccount(account_) returns (uint256) {
        uint256 accountShares = shares[account_];
        if (accountShares < amount_) revert ErrorNotEnoughBalance();
        totalShares = totalShares - amount_;
        shares[account_] = accountShares - amount_;
        emit Transfer(account_, address(0), amount_);
        return totalShares;
    }

    /// @dev  Moves `sharesAmount_` shares from `sender_` to `recipient_`.
    /// @param sender_ An address of the account to take shares
    /// @param recipient_ An address of the account to transfer shares
    /// @param sharesAmount_ An amount of shares to transfer
    function _transferShares(
        address sender_,
        address recipient_,
        uint256 sharesAmount_
    ) internal onlyNonZeroAccount(sender_) onlyNonZeroAccount(recipient_) {
        
        if (recipient_ == address(this)) revert ErrorTrasferToRebasableContract();

        uint256 currentSenderShares = shares[sender_];
        if (sharesAmount_ > currentSenderShares) revert ErrorNotEnoughBalance();

        shares[sender_] = currentSenderShares - sharesAmount_;
        shares[recipient_] = shares[recipient_] + sharesAmount_;
    }

    /// @dev validates that account_ is not zero address
    modifier onlyNonZeroAccount(address account_) {
        if (account_ == address(0)) {
            revert ErrorAccountIsZeroAddress();
        }
        _;
    }
}