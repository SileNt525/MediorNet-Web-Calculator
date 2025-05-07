// js/main.js (修正非模块版本的潜在冲突)

// ---- 从文件顶部移除这两行 ----
// let networkManager;
// let uiController;
// ---------------------------

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 已加载，开始初始化应用...");

    // --- 在事件监听器内部声明和初始化 ---
    // 使用 const 或 let 声明在这里
    const networkManagerInstance = new NetworkManager();
    const uiControllerInstance = new UIController(networkManagerInstance);
    // ------------------------------------

    // 初始化 UI 控制器 (填充下拉框, 绑定事件等)
    uiControllerInstance.initialize(); // 使用局部实例

    console.log("应用初始化完成。");

    // --- (可选) 添加一些示例/测试代码 ---
    // networkManagerInstance.addDevice("UHD-1", DEV_UHD, 2, 2, 0); // 使用局部实例
    // networkManagerInstance.addDevice("MN-1", DEV_MN, 0, 0, 8);
    // uiControllerInstance._updateDeviceTable();
    // uiControllerInstance._updatePortTotalsDisplay();
    // uiControllerInstance._updateButtonStates();

});