// js/networkManager.js
// 暂时只作为占位符，后续会实现核心计算逻辑

class NetworkManager {
    constructor() {
        this.devices = []; // 将设备列表移到这里管理更合理
        this.connections = [];
        this.deviceIdCounter = 0;
    }

    addDevice(name, type, mpoPorts, lcPorts, sfpPorts) {
        // 检查名称是否重复
        if (this.devices.some(dev => dev.name === name)) {
            console.error(`错误: 设备名称 '${name}' 已存在。`);
            alert(`错误: 设备名称 '${name}' 已存在。`); // 简单提示
            return null;
        }
        this.deviceIdCounter++;
        const newDevice = new Device(this.deviceIdCounter, name, type, mpoPorts, lcPorts, sfpPorts);
        this.devices.push(newDevice);
        console.log(`设备已添加: ${newDevice.name} (ID: ${newDevice.id})`);
        return newDevice;
    }

    removeDevice(deviceId) {
        const initialLength = this.devices.length;
        this.devices = this.devices.filter(dev => dev.id !== deviceId);
        // TODO: 在实现连接后，这里还需要移除与该设备相关的连接
        return this.devices.length < initialLength;
    }

    getDeviceById(deviceId) {
        return this.devices.find(dev => dev.id === deviceId);
    }

    getAllDevices() {
        return this.devices;
    }

    clearAllDevicesAndConnections() {
        this.devices = [];
        this.connections = [];
        this.deviceIdCounter = 0;
        console.log("所有设备和连接已清空。");
    }

    clearConnections() {
        // TODO: 重置所有设备的端口状态
        this.devices.forEach(dev => dev.resetPorts());
        this.connections = [];
        console.log("所有连接已清除。");
    }

    getAllConnections() {
        return this.connections;
    }

     calculatePortTotals() {
        let totalMPO = 0;
        let totalLC = 0;
        let totalSFP = 0;
        this.devices.forEach(dev => {
            totalMPO += dev.mpoTotal;
            totalLC += dev.lcTotal;
            totalSFP += dev.sfpTotal;
        });
        return { mpo: totalMPO, lc: totalLC, sfp: totalSFP };
    }

    // --- 未来需要添加的计算逻辑 ---
    // addConnection(dev1Id, port1, dev2Id, port2) { ... }
    // addBestConnection(dev1Id, dev2Id) { ... }
    // calculateMesh() { ... }
    // calculateRing() { ... }
    // fillConnectionsMesh() { ... }
    // fillConnectionsRing() { ... }
    // checkPortCompatibility(dev1Id, port1, dev2Id, port2) { ... }
    // getAvailablePorts(deviceId) { ... }
    // _updateGraph() { ... } // Web 版需要适配 Cytoscape.js
    // getGraph() { ... }
    // saveProject() { ... } // 需要适配 Web API
    // loadProject() { ... } // 需要适配 Web API
}