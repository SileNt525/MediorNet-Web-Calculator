// js/device.js

// --- 常量定义 ---
const DEV_UHD = 'MicroN UHD';
const DEV_HORIZON = 'HorizoN';
const DEV_MN = 'MicroN';
const UHD_TYPES = [DEV_UHD, DEV_HORIZON];

const PORT_MPO = 'MPO';
const PORT_LC = 'LC';
const PORT_SFP = 'SFP';
const PORT_UNKNOWN = 'Unknown';

// --- 辅助函数 ---
function getPortTypeFromName(portName) {
    if (typeof portName !== 'string') {
        return PORT_UNKNOWN;
    }
    if (portName.startsWith(PORT_LC)) {
        return PORT_LC;
    }
    if (portName.startsWith(PORT_SFP)) {
        return PORT_SFP;
    }
    // MPO 端口可能包含通道号，例如 "MPO1-Ch2"
    if (portName.startsWith(PORT_MPO)) {
        return PORT_MPO;
    }
    return PORT_UNKNOWN;
}

// --- Device 类 ---
class Device {
    constructor(id, name, type, mpoPorts = 0, lcPorts = 0, sfpPorts = 0) {
        this.id = id; // 设备的唯一标识符 (number)
        this.name = name; // 设备名称 (string)
        this.type = type; // 设备类型 (string, 使用常量)

        // 存储总端口数
        this.mpoTotal = (UHD_TYPES.includes(type)) ? parseInt(mpoPorts, 10) || 0 : 0;
        this.lcTotal = (UHD_TYPES.includes(type)) ? parseInt(lcPorts, 10) || 0 : 0;
        this.sfpTotal = (type === DEV_MN) ? parseInt(sfpPorts, 10) || 0 : 0;

        this.resetPorts();
    }

    resetPorts() {
        // 重置端口连接状态
        this.connections = 0.0; // 使用浮点数精确表示 MPO 连接
        // 存储端口连接信息 { portName: targetDeviceName }
        this.portConnections = {};
        // (可选) 缓存可用端口，避免重复计算
        this._availablePortsCache = null;
        this._allPossiblePortsCache = null;
    }

    getAllPossiblePorts() {
        // 如果有缓存则直接返回
        if (this._allPossiblePortsCache) {
            return this._allPossiblePortsCache;
        }

        const ports = [];
        // LC 端口 (仅 UHD/HorizoN)
        for (let i = 0; i < this.lcTotal; i++) {
            ports.push(`${PORT_LC}${i + 1}`);
        }
        // SFP+ 端口 (仅 MicroN)
        for (let i = 0; i < this.sfpTotal; i++) {
            ports.push(`${PORT_SFP}${i + 1}`);
        }
        // MPO 端口 (仅 UHD/HorizoN)，每个 MPO 4 个 Breakout 通道
        for (let i = 0; i < this.mpoTotal; i++) {
            const base = `${PORT_MPO}${i + 1}`;
            for (let j = 0; j < 4; j++) {
                ports.push(`${base}-Ch${j + 1}`);
            }
        }
        this._allPossiblePortsCache = ports; // 缓存结果
        return ports;
    }

    getAllAvailablePorts() {
        // 如果有缓存则直接返回
        // 注意：每次端口状态变化 (use/return) 都需要清除缓存
        if (this._availablePortsCache) {
            return this._availablePortsCache;
        }

        const allPorts = this.getAllPossiblePorts();
        const usedPorts = new Set(Object.keys(this.portConnections));
        const available = allPorts.filter(p => !usedPorts.has(p));

        this._availablePortsCache = available; // 缓存结果
        return available;
    }

    // 标记端口为已使用
    useSpecificPort(portName, targetDeviceName) {
        const allPorts = this.getAllPossiblePorts();
        if (allPorts.includes(portName) && !(portName in this.portConnections)) {
            this.portConnections[portName] = targetDeviceName;
            // 更新连接计数
            const portType = getPortTypeFromName(portName);
            if (portType === PORT_MPO) {
                this.connections += 0.25;
            } else if ([PORT_LC, PORT_SFP].includes(portType)) {
                this.connections += 1.0;
            } else {
                console.warn(`警告: 在设备 ${this.name} 上使用未知类型的端口 ${portName} 进行连接计数。`);
            }
             // 清除缓存
            this._availablePortsCache = null;
            return true;
        }
        console.debug(`调试: 尝试使用端口 ${this.name}[${portName}] 失败。可能原因：无效端口或已被占用 (${portName in this.portConnections})`);
        return false;
    }

    // 释放端口
    returnPort(portName) {
        if (portName in this.portConnections) {
            const target = this.portConnections[portName];
            delete this.portConnections[portName];
            // 更新连接计数
            const portType = getPortTypeFromName(portName);
            if (portType === PORT_MPO) {
                this.connections -= 0.25;
            } else if ([PORT_LC, PORT_SFP].includes(portType)) {
                this.connections -= 1.0;
            } else {
                 console.warn(`警告: 在设备 ${this.name} 上归还未知类型的端口 ${portName} 进行连接计数。`);
            }
            // 确保连接数不为负
            this.connections = Math.max(0.0, this.connections);
             // 清除缓存
            this._availablePortsCache = null;
            console.debug(`调试: 端口 ${this.name}[${portName}] 已释放 (之前连接到 ${target})。当前连接数: ${this.connections.toFixed(2)}`);
        } else {
             console.debug(`调试: 尝试释放端口 ${this.name}[${portName}]，但它不在已连接列表中。`);
        }
    }

     // 获取特定类型的第一个可用端口 (用于探测)
    getSpecificAvailablePort(portTypePrefix) {
        const availablePorts = this.getAllAvailablePorts();
        // 需要实现类似 Python 版本中的排序逻辑来保证优先级
        // 简单实现：直接查找第一个匹配前缀的端口
        return availablePorts.find(port => port.startsWith(portTypePrefix)) || null;
    }

    // (未来可能需要) 从字典创建 Device 对象
    static fromDict(data) {
        // ... 实现从 JS 对象创建 Device 实例 ...
        // 需要处理默认值和 ID
    }

    // (未来可能需要) 将 Device 对象转换为字典
    toDict() {
        // ... 实现将 Device 实例转换为 JS 对象 ...
        // 不包含 portConnections
        return {
             id: this.id,
             name: this.name,
             type: this.type,
             mpo_ports: this.mpoTotal,
             lc_ports: this.lcTotal,
             sfp_ports: this.sfpTotal
        };
    }

    // 获取连接数的格式化字符串
    getConnectionsFormatted() {
        // MPO 算 0.25，确保显示为整数或 .25, .5, .75
        const remainder = this.connections % 1;
        if (remainder === 0) return this.connections.toString();
        if (remainder === 0.25) return this.connections.toFixed(2);
        if (remainder === 0.5) return this.connections.toFixed(2);
        if (remainder === 0.75) return this.connections.toFixed(2);
        return this.connections.toFixed(2); // 其他情况保留两位小数
    }
}