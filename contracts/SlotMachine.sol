// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SlotMachine {
    address public owner;
    uint public spinPrice = 0.01 ether; // цена одного спина

    // Балансы игроков
    mapping(address => uint) public balances;

    // история игр
    struct SpinHistory {
        address player;
        uint[3] reels;    // 3 барабана
        uint bet;
        uint winAmount;
        uint timestamp;
    }

    mapping(address => SpinHistory[]) public history;

    event Deposit(address indexed player, uint amount);
    event Withdraw(address indexed player, uint amount);
    event SpinPlayed(address indexed player, uint bet, uint[3] reels, uint winAmount, uint timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Пополнение баланса
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // Снять деньги с баланса
    function withdraw(uint amount) external {
        require(balances[msg.sender] >= amount, "Not enough balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    // Играть
    function play() external {
        require(balances[msg.sender] >= spinPrice, "Not enough balance");

        // списываем ставку
        balances[msg.sender] -= spinPrice;

        // генерируем 3 барабана
        uint[3] memory reels;
        for (uint i = 0; i < 3; i++) {
            reels[i] = random(i) % 5;
        }

        uint winAmount = calculateWin(reels);

        if (winAmount > 0) {
            balances[msg.sender] += winAmount; // зачисляем выигрыш
        }

        history[msg.sender].push(
            SpinHistory(msg.sender, reels, spinPrice, winAmount, block.timestamp)
        );

        emit SpinPlayed(msg.sender, spinPrice, reels, winAmount, block.timestamp);
    }

    // выигрыш
    function calculateWin(uint[3] memory reels) internal view returns (uint) {
        // все три одинаковые  x10
        if (reels[0] == reels[1] && reels[1] == reels[2]) {
            return spinPrice * 10;
        }
        // два одинаковые  x2
        if (reels[0] == reels[1] || reels[0] == reels[2] || reels[1] == reels[2]) {
            return spinPrice * 2;
        }
        return 0;
    }

    // случайное число
    function random(uint nonce) internal view returns (uint) {
        return uint(
            keccak256(
                abi.encodePacked(block.timestamp, msg.sender, nonce, block.prevrandao)
            )
        );
    }

    // история
    function getHistory(address player) external view returns (SpinHistory[] memory) {
        return history[player];
    }
}