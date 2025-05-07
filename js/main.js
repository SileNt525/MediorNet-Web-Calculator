// js/main.js (修正非模块版本的潜在冲突)

// ---- 从文件顶部移除这两行 ----
// let networkManager;
// let uiController;
// ---------------------------

// 等待 DOM 加载完成
// js/main.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 已加载，准备初始化...");

    // 检查类是否已定义
    console.log("检查类定义:");
    try {
        console.log("typeof Device:", typeof Device); // 应该输出 'function'
    } catch (e) { console.error("Device 未定义:", e); }
    try {
        console.log("typeof NetworkManager:", typeof NetworkManager); // 应该输出 'function'
    } catch (e) { console.error("NetworkManager 未定义:", e); }
    try {
        console.log("typeof UIController:", typeof UIController); // 应该输出 'function'
    } catch (e) { console.error("UIController 未定义:", e); }


    console.log("尝试创建 NetworkManager 实例...");
    const networkManagerInstance = new NetworkManager();
    console.log("networkManagerInstance 已创建:", networkManagerInstance);

    console.log("尝试创建 UIController 实例...");
    const uiControllerInstance = new UIController(networkManagerInstance); // 之前的第 18 行左右
    console.log("uiControllerInstance 已创建:", uiControllerInstance); // 看看这个实例是什么样的

    console.log("尝试调用 uiControllerInstance.initialize()..."); // 之前的第 19 行左右
    // ---- 在调用前检查方法是否存在 ----
    if (uiControllerInstance && typeof uiControllerInstance.initialize === 'function') {
        uiControllerInstance.initialize(); // 调用 initialize
    } else {
        console.error("错误: uiControllerInstance 上找不到 initialize 方法!", uiControllerInstance);
    }
    // --------------------------------

    console.log("应用初始化流程结束。");
});
