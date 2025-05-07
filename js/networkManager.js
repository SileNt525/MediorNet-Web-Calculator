// js/networkManager.js

class NetworkManager {
    constructor() {
        this.devices = [];
        this.connections = []; // 存储连接元组: [device1, port1Name, device2, port2Name, connectionTypeString]
        this.deviceIdCounter = 0;
    }

    // --- 设备管理 (保持不变) ---
    addDevice(name, type, mpoPorts, lcPorts, sfpPorts) {
        if (this.devices.some(dev => dev.name === name)) {
            console.error(`错误: 设备名称 '${name}' 已存在。`);
            alert(`错误: 设备名称 '${name}' 已存在。`);
            return null;
        }
        this.deviceIdCounter++;
        const newDevice = new Device(this.deviceIdCounter, name, type, mpoPorts, lcPorts, sfpPorts);
        this.devices.push(newDevice);
        console.log(`设备已添加: ${newDevice.name} (ID: ${newDevice.id})`);
        // 未来: 更新图模型
        this._updateGraph();
        return newDevice;
    }

    removeDevice(deviceId) {
        deviceId = parseInt(deviceId, 10);
        const deviceToRemove = this.getDeviceById(deviceId);
        if (!deviceToRemove) {
            console.error(`错误: 找不到 ID 为 ${deviceId} 的设备进行移除。`);
            return false;
        }

        // 1. 移除与该设备相关的所有连接
        const connectionsRemovedCount = this._removeConnectionsForDevice(deviceId);
        console.log(`移除设备 ${deviceToRemove.name} 时，移除了 ${connectionsRemovedCount} 条相关连接。`);

        // 2. 从设备列表中移除设备
        const initialLength = this.devices.length;
        this.devices = this.devices.filter(dev => dev.id !== deviceId);

        // 3. 更新图模型
        this._updateGraph();

        console.log(`设备已移除: ${deviceToRemove.name}`);
        return this.devices.length < initialLength;
    }

     getDeviceById(deviceId) {
        deviceId = parseInt(deviceId, 10);
        return this.devices.find(dev => dev.id === deviceId);
    }

     getAllDevices() {
        return this.devices;
    }

    clearAllDevicesAndConnections() {
        this.devices = [];
        this.connections = [];
        this.deviceIdCounter = 0;
        this._updateGraph(); // 清空图
        console.log("所有设备和连接已清空。");
    }


    // --- 连接管理 ---

    /**
     * 检查两个指定端口之间是否兼容。
     * @param {number} dev1Id - 设备 1 的 ID。
     * @param {string} port1Name - 设备 1 的端口名称。
     * @param {number} dev2Id - 设备 2 的 ID。
     * @param {string} port2Name - 设备 2 的端口名称。
     * @returns {[boolean, string|null]} 返回一个数组 [是否兼容, 连接类型描述字符串 或 null]。
     */
    check_port_compatibility(dev1Id, port1Name, dev2Id, port2Name) {
        const dev1 = this.getDeviceById(dev1Id);
        const dev2 = this.getDeviceById(dev2Id);
        if (!dev1 || !dev2) {
            return [false, null];
        }

        const port1Type = getPortTypeFromName(port1Name);
        const port2Type = getPortTypeFromName(port2Name);
        const is_uhd1 = UHD_TYPES.includes(dev1.type);
        const is_uhd2 = UHD_TYPES.includes(dev2.type);
        const is_mn1 = dev1.type === DEV_MN;
        const is_mn2 = dev2.type === DEV_MN;

        // 规则 1: LC 只能 UHD/HorizoN 之间互连
        if (port1Type === PORT_LC && port2Type === PORT_LC && is_uhd1 && is_uhd2) {
            return [true, `${PORT_LC}-${PORT_LC} (100G)`];
        }
        // 规则 2: MPO 只能 UHD/HorizoN 之间互连
        if (port1Type === PORT_MPO && port2Type === PORT_MPO && is_uhd1 && is_uhd2) {
            return [true, `${PORT_MPO}-${PORT_MPO} (25G)`];
        }
        // 规则 3: SFP 只能 MicroN 之间互连
        if (port1Type === PORT_SFP && port2Type === PORT_SFP && is_mn1 && is_mn2) {
            return [true, `${PORT_SFP}-${PORT_SFP} (10G)`];
        }
        // 规则 4: MPO (UHD/HorizoN) 可以连接 SFP (MicroN)
        if (port1Type === PORT_MPO && port2Type === PORT_SFP && is_uhd1 && is_mn2) {
            return [true, `${PORT_MPO}-${PORT_SFP} (10G)`];
        }
        if (port1Type === PORT_SFP && port2Type === PORT_MPO && is_mn1 && is_uhd2) {
            return [true, `${PORT_MPO}-${PORT_SFP} (10G)`]; // 描述统一
        }

        // 其他组合均不兼容
        return [false, null];
    }


    /**
     * 在两个设备之间添加一条手动连接。
     * @param {number} dev1Id - 设备 1 的 ID。
     * @param {string} port1Name - 设备 1 的端口名称。
     * @param {number} dev2Id - 设备 2 的 ID。
     * @param {string} port2Name - 设备 2 的端口名称。
     * @returns {Array|null} 如果连接成功添加，返回连接数组 [dev1, port1Name, dev2, port2Name, connTypeStr]，否则返回 null。
     */
    add_connection(dev1Id, port1Name, dev2Id, port2Name) {
        const dev1 = this.getDeviceById(dev1Id);
        const dev2 = this.getDeviceById(dev2Id);

        if (!dev1 || !dev2) {
            console.error(`错误: 添加连接时找不到设备 ID ${dev1Id} 或 ${dev2Id}。`);
            return null;
        }
        if (dev1Id === dev2Id) {
             console.error(`错误: 不能将设备 ${dev1.name} 连接到自身。`);
             alert(`错误: 不能将设备 ${dev1.name} 连接到自身。`);
             return null;
        }

        // 检查端口是否有效且可用
        if (!dev1.getAllPossiblePorts().includes(port1Name)) {
             console.error(`错误: 端口 '${port1Name}' 在设备 '${dev1.name}' 上无效。`);
             alert(`错误: 端口 '${port1Name}' 在设备 '${dev1.name}' 上无效。`);
             return null;
        }
        if (!dev2.getAllPossiblePorts().includes(port2Name)) {
             console.error(`错误: 端口 '${port2Name}' 在设备 '${dev2.name}' 上无效。`);
              alert(`错误: 端口 '${port2Name}' 在设备 '${dev2.name}' 上无效。`);
             return null;
        }
         if (!dev1.getAllAvailablePorts().includes(port1Name)) {
             const target = dev1.portConnections[port1Name];
             console.error(`错误: 端口 '${port1Name}' 在设备 '${dev1.name}' 上已被占用 (连接到 ${target})。`);
             alert(`错误: 端口 '${port1Name}' 在设备 '${dev1.name}' 上已被占用 (连接到 ${target})。`);
             return null;
         }
         if (!dev2.getAllAvailablePorts().includes(port2Name)) {
             const target = dev2.portConnections[port2Name];
             console.error(`错误: 端口 '${port2Name}' 在设备 '${dev2.name}' 上已被占用 (连接到 ${target})。`);
             alert(`错误: 端口 '${port2Name}' 在设备 '${dev2.name}' 上已被占用 (连接到 ${target})。`);
             return null;
         }

        // 检查兼容性
        const [compatible, connTypeStr] = this.check_port_compatibility(dev1Id, port1Name, dev2Id, port2Name);
        if (!compatible) {
            console.error(`错误: 端口 ${dev1.name}[${port1Name}] 与 ${dev2.name}[${port2Name}] 不兼容。`);
             alert(`端口 ${dev1.name}[${port1Name}] 与 ${dev2.name}[${port2Name}] 不兼容。`);
            return null;
        }

        // 尝试占用端口并添加连接
        if (dev1.useSpecificPort(port1Name, dev2.name)) {
            if (dev2.useSpecificPort(port2Name, dev1.name)) {
                const connection = [dev1, port1Name, dev2, port2Name, connTypeStr];
                this.connections.push(connection);
                // 更新图
                this._updateGraph();
                console.log(`连接已添加: ${dev1.name}[${port1Name}] <-> ${dev2.name}[${port2Name}] (${connTypeStr})`);
                return connection;
            } else {
                // 如果占用 dev2 端口失败，需要回滚 dev1 的端口占用
                dev1.returnPort(port1Name);
                console.error(`错误: 占用端口 ${dev2.name}[${port2Name}] 失败，回滚操作。`);
                return null;
            }
        } else {
            console.error(`错误: 占用端口 ${dev1.name}[${port1Name}] 失败。`);
            return null;
        }
    }

     /**
      * 移除指定的连接。
      * @param {number} dev1Id - 设备 1 的 ID。
      * @param {string} port1Name - 设备 1 的端口名称。
      * @param {number} dev2Id - 设备 2 的 ID。
      * @param {string} port2Name - 设备 2 的端口名称。
      * @returns {boolean} 如果成功找到并移除连接则返回 True，否则返回 False。
      */
     remove_connection(dev1Id, port1Name, dev2Id, port2Name) {
         let foundIndex = -1;
         for (let i = 0; i < this.connections.length; i++) {
             const [cDev1, cPort1, cDev2, cPort2, _] = this.connections[i];
             if ((cDev1.id === dev1Id && cPort1 === port1Name && cDev2.id === dev2Id && cPort2 === port2Name) ||
                 (cDev1.id === dev2Id && cPort1 === port2Name && cDev2.id === dev1Id && cPort2 === port1Name)) {
                 foundIndex = i;
                 break;
             }
         }

         if (foundIndex !== -1) {
             const removedConn = this.connections.splice(foundIndex, 1)[0]; // 移除连接
             const [dev1, port1, dev2, port2, _] = removedConn;

             // 释放两端的端口 (需要获取最新的设备对象引用，以防万一)
             const actualDev1 = this.getDeviceById(dev1.id);
             const actualDev2 = this.getDeviceById(dev2.id);
             if (actualDev1) actualDev1.returnPort(port1);
             else console.warn(`警告: 移除连接时找不到设备 ID ${dev1.id}`);
             if (actualDev2) actualDev2.returnPort(port2);
             else console.warn(`警告: 移除连接时找不到设备 ID ${dev2.id}`);

             // 更新图
             this._updateGraph();
             console.log(`连接已移除: ${dev1.name}[${port1}] <-> ${dev2.name}[${port2}]`);
             return true;
         } else {
             console.error(`错误: 未找到要移除的连接: ${dev1Id}[${port1Name}] <-> ${dev2Id}[${port2Name}]`);
             return false;
         }
     }


     /**
      * 移除与指定设备相关的所有连接（内部辅助方法）。
      * @param {number} deviceId - 设备的 ID。
      * @returns {number} 被移除的连接数量。
      */
      _removeConnectionsForDevice(deviceId) {
         deviceId = parseInt(deviceId, 10);
         const connectionsToRemove = [];
         const indicesToRemove = new Set();

         // 查找所有涉及该设备的连接
         this.connections.forEach((conn, i) => {
             if (conn[0].id === deviceId || conn[2].id === deviceId) {
                 connectionsToRemove.push(conn);
                 indicesToRemove.add(i);
             }
         });

         const removedCount = connectionsToRemove.length;
         if (removedCount > 0) {
             // 释放涉及的端口
             connectionsToRemove.forEach(conn => {
                 const [dev1, port1, dev2, port2, _] = conn;
                 const actualDev1 = this.getDeviceById(dev1.id);
                 const actualDev2 = this.getDeviceById(dev2.id);
                 if (actualDev1) actualDev1.returnPort(port1);
                 if (actualDev2) actualDev2.returnPort(port2);
             });

             // 从主连接列表中移除（从后往前删）
             const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
             sortedIndices.forEach(index => {
                 this.connections.splice(index, 1);
             });

             // 更新图 (JS 版图更新逻辑需要适配 Cytoscape.js)
             this._updateGraph();
         }
         return removedCount;
      }


    /** 清除所有连接，并重置所有设备的端口状态。 */
    clearConnections() {
        if (this.connections.length === 0) return;

        console.log(`正在清除 ${this.connections.length} 条连接...`);
        // 重置所有设备的端口状态
        this.devices.forEach(dev => dev.resetPorts());
        // 清空连接列表
        this.connections = [];
        // 更新图 (移除所有边)
        this._updateGraph();
        console.log("所有连接已清除，设备端口状态已重置。");
    }

    /** 获取当前所有连接的列表。 */
    getAllConnections() {
        return this.connections;
    }

    /** 计算当前所有设备各类端口的总数。 */
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

    /** 更新图模型 - 需要适配 Web 可视化库 (例如 Cytoscape.js) */
    _updateGraph() {
        // TODO: 实现使用 Cytoscape.js 更新图形的逻辑
        // 1. 清除旧图元素 (如果需要)
        // 2. 添加节点 (基于 this.devices)
        // 3. 添加边 (基于 this.connections)，可能需要聚合边
        console.log("图更新逻辑占位符 - 需要集成 Cytoscape.js");
    }

    /** 获取图形数据 - 需要适配 Web 可视化库 */
    /**
     * 获取适合 Cytoscape.js 使用的拓扑数据。
     * @returns {{nodes: Array, edges: Array}} 包含节点和边数据的对象。
     */
    getTopologyData() {
        const nodes = this.devices.map(dev => ({
            data: {
                id: dev.id.toString(), // Cytoscape ID 通常是字符串
                label: `<span class="math-inline">\{dev\.name\}\\n\(</span>{dev.type})`, // 节点标签
                deviceType: dev.type, // 自定义数据，用于样式
                // 可以添加其他需要的数据，如端口总数等
            }
            // position: { x: ..., y: ... } // 初始位置可以后续由布局算法或用户拖拽决定
        }));

        const edges = [];
        // 需要聚合连接，相同设备对之间的多种连接类型显示为一条边或多条平行边
        const edgeAggregator = {}; // key: "devId1-devId2", value: { types: {}, count: 0, ports: [] }

        this.connections.forEach(conn => {
            const [dev1, port1, dev2, port2, connTypeStr] = conn;
            // 确保边的 key 顺序一致
            const id1 = dev1.id;
            const id2 = dev2.id;
            const edgeKey = id1 < id2 ? `<span class="math-inline">\{id1\}\-</span>{id2}` : `<span class="math-inline">\{id2\}\-</span>{id1}`;

            if (!edgeAggregator[edgeKey]) {
                edgeAggregator[edgeKey] = { types: {}, count: 0, ports: [] };
            }

            // 聚合连接类型计数
            const baseConnType = connTypeStr.split(' ')[0]; // e.g., "LC-LC"
            if (!edgeAggregator[edgeKey].types[baseConnType]) {
                edgeAggregator[edgeKey].types[baseConnType] = { count: 0, fullType: connTypeStr };
            }
            edgeAggregator[edgeKey].types[baseConnType].count++;
            edgeAggregator[edgeKey].count++;

            // 记录端口信息 (确保 source/target 对应 key 的顺序)
            if (id1 < id2) {
                 edgeAggregator[edgeKey].ports.push({ sourcePort: port1, targetPort: port2, type: connTypeStr });
            } else {
                 edgeAggregator[edgeKey].ports.push({ sourcePort: port2, targetPort: port1, type: connTypeStr });
            }
        });

        // 构建 Cytoscape 边数据
        Object.keys(edgeAggregator).forEach((edgeKey, index) => {
            const [sourceId, targetId] = edgeKey.split('-');
            const edgeData = edgeAggregator[edgeKey];

            // 创建边标签，显示聚合后的类型和数量
            const labelParts = Object.values(edgeData.types).map(typeInfo => `<span class="math-inline">\{typeInfo\.fullType\} x</span>{typeInfo.count}`);
            const edgeLabel = labelParts.join('\n');

            // 决定边的类型或样式（基于第一个连接类型）
            const firstType = Object.values(edgeData.types)[0].fullType;
            let edgeStyleClass = 'default-edge'; // 用于 CSS 或样式选择器
             if (firstType.startsWith('LC-LC')) edgeStyleClass = 'lc-lc-edge';
             else if (firstType.startsWith('MPO-MPO')) edgeStyleClass = 'mpo-mpo-edge';
             else if (firstType.startsWith('MPO-SFP')) edgeStyleClass = 'mpo-sfp-edge';
             else if (firstType.startsWith('SFP-SFP')) edgeStyleClass = 'sfp-sfp-edge';

            edges.push({
                data: {
                    id: `e${index}`, // 唯一边 ID
                    source: sourceId, // 源节点 ID (字符串)
                    target: targetId, // 目标节点 ID (字符串)
                    label: edgeLabel, // 边标签
                    count: edgeData.count, // 总连接数
                    ports: edgeData.ports, // 详细端口信息
                    styleClass: edgeStyleClass // 用于区分样式的类名
                }
            });
        });

        return { nodes, edges };
    }

    // _updateGraph 方法现在可以调用 getTopologyData 并触发 UI 更新
    _updateGraph() {
        // 这个函数本身不直接绘图，而是通知 UI 需要更新
        // 在 UIController 中会获取数据并重新渲染图形
        console.log("图数据模型已更新，需要通知 UI 重绘。");
        // 如果 UIController 有一个专门的更新图的方法，可以在这里触发事件或直接调用
        // 例如: this.emit('graphNeedsUpdate');
    }


    // --- 待实现的计算逻辑 ---

/**
     * 辅助函数：查找两个设备副本之间最高优先级的单个可用连接。
     * 此方法会修改传入的设备副本状态 (dev1Copy, dev2Copy)。
     * @param {Device} dev1Copy - 设备 1 的副本 (期望是调用者传入的深拷贝)。
     * @param {Device} dev2Copy - 设备 2 的副本 (期望是调用者传入的深拷贝)。
     * @returns {[string|null, string|null, string|null]} 返回 [dev1副本端口名, dev2副本端口名, 连接类型描述] 或 [null, null, null]。
     */
  /**
     * 辅助函数：查找两个设备副本之间最高优先级的单个可用连接。
     * 此方法会修改传入的设备副本状态 (dev1Copy, dev2Copy)。
     * @param {Device} dev1Copy - 设备 1 的副本。
     * @param {Device} dev2Copy - 设备 2 的副本。
     * @returns {[string|null, string|null, string|null]} 返回 [dev1副本端口名, dev2副本端口名, 连接类型描述] 或 [null, null, null]。
     */
  _find_best_single_link(dev1Copy, dev2Copy) {
    const is_uhd1 = UHD_TYPES.includes(dev1Copy.type);
    const is_uhd2 = UHD_TYPES.includes(dev2Copy.type);
    const is_mn1 = dev1Copy.type === DEV_MN;
    const is_mn2 = dev2Copy.type === DEV_MN;

    // --- 优先级 1: 尝试 LC-LC (仅 UHD/HorizoN 之间) ---
    if (is_uhd1 && is_uhd2) {
        // 需要找到设备各自的第一个可用 LC 端口
        // 注意：getSpecificAvailablePort 只是查找，不占用
        const port1_lc = dev1Copy.getSpecificAvailablePort(PORT_LC);
        const port2_lc = dev2Copy.getSpecificAvailablePort(PORT_LC);

        if (port1_lc && port2_lc) {
            // 确认找到端口后，尝试在副本上标记使用
            if (dev1Copy.useSpecificPort(port1_lc, dev2Copy.name) && dev2Copy.useSpecificPort(port2_lc, dev1Copy.name)) {
                 // console.log(`_find_best_single_link: 找到 LC-LC: ${port1_lc} <-> ${port2_lc}`);
                 return [port1_lc, port2_lc, `${PORT_LC}-${PORT_LC} (100G)`];
            } else {
                 // 如果标记失败，回滚
                 console.warn(`警告: _find_best_single_link 中 LC 端口副本占用失败 ${dev1Copy.name}[${port1_lc}] 或 ${dev2Copy.name}[${port2_lc}]`);
                 if (port1_lc in dev1Copy.portConnections) dev1Copy.returnPort(port1_lc); // 检查是否真的占用了再归还
                 if (port2_lc in dev2Copy.portConnections) dev2Copy.returnPort(port2_lc);
            }
        }
    }

    // --- 优先级 2: 尝试 MPO-MPO (仅 UHD/HorizoN 之间) ---
    if (is_uhd1 && is_uhd2) {
        const port1_mpo = dev1Copy.getSpecificAvailablePort(PORT_MPO); // 查找 MPO 端口 (例如 MPO1-Ch1)
        const port2_mpo = dev2Copy.getSpecificAvailablePort(PORT_MPO);

        if (port1_mpo && port2_mpo) {
             if (dev1Copy.useSpecificPort(port1_mpo, dev2Copy.name) && dev2Copy.useSpecificPort(port2_mpo, dev1Copy.name)) {
                 // console.log(`_find_best_single_link: 找到 MPO-MPO: ${port1_mpo} <-> ${port2_mpo}`);
                return [port1_mpo, port2_mpo, `${PORT_MPO}-${PORT_MPO} (25G)`];
             } else {
                 console.warn(`警告: _find_best_single_link 中 MPO 端口副本占用失败 ${dev1Copy.name}[${port1_mpo}] 或 ${dev2Copy.name}[${port2_mpo}]`);
                 if (port1_mpo in dev1Copy.portConnections) dev1Copy.returnPort(port1_mpo);
                 if (port2_mpo in dev2Copy.portConnections) dev2Copy.returnPort(port2_mpo);
             }
        }
    }

    // --- 优先级 3: 尝试 SFP-SFP (仅 MicroN 之间) ---
    if (is_mn1 && is_mn2) {
        const port1_sfp = dev1Copy.getSpecificAvailablePort(PORT_SFP);
        const port2_sfp = dev2Copy.getSpecificAvailablePort(PORT_SFP);

        if (port1_sfp && port2_sfp) {
             if (dev1Copy.useSpecificPort(port1_sfp, dev2Copy.name) && dev2Copy.useSpecificPort(port2_sfp, dev1Copy.name)) {
                 // console.log(`_find_best_single_link: 找到 SFP-SFP: ${port1_sfp} <-> ${port2_sfp}`);
                return [port1_sfp, port2_sfp, `${PORT_SFP}-${PORT_SFP} (10G)`];
             } else {
                  console.warn(`警告: _find_best_single_link 中 SFP 端口副本占用失败 ${dev1Copy.name}[${port1_sfp}] 或 ${dev2Copy.name}[${port2_sfp}]`);
                 if (port1_sfp in dev1Copy.portConnections) dev1Copy.returnPort(port1_sfp);
                 if (port2_sfp in dev2Copy.portConnections) dev2Copy.returnPort(port2_sfp);
             }
        }
    }

    // --- 优先级 4: 尝试 MPO-SFP (UHD/HorizoN 与 MicroN 之间) ---
    let uhdDevCopy = null;
    let micronDevCopy = null;
    let dev1IsUhd = false; // 标记原始 dev1Copy 是否是 UHD

    if (is_uhd1 && is_mn2) {
        uhdDevCopy = dev1Copy;
        micronDevCopy = dev2Copy;
        dev1IsUhd = true;
    } else if (is_mn1 && is_uhd2) {
        uhdDevCopy = dev2Copy;
        micronDevCopy = dev1Copy;
        dev1IsUhd = false;
    }

    if (uhdDevCopy && micronDevCopy) {
        const port_uhd_mpo = uhdDevCopy.getSpecificAvailablePort(PORT_MPO);
        const port_micron_sfp = micronDevCopy.getSpecificAvailablePort(PORT_SFP);

        if (port_uhd_mpo && port_micron_sfp) {
             if (uhdDevCopy.useSpecificPort(port_uhd_mpo, micronDevCopy.name) && micronDevCopy.useSpecificPort(port_micron_sfp, uhdDevCopy.name)) {
                 // console.log(`_find_best_single_link: 找到 MPO-SFP: ${port_uhd_mpo} <-> ${port_micron_sfp}`);
                 // 返回端口时，确保顺序与传入的 dev1Copy, dev2Copy 对应
                 if (dev1IsUhd) {
                     return [port_uhd_mpo, port_micron_sfp, `${PORT_MPO}-${PORT_SFP} (10G)`];
                 } else {
                     return [port_micron_sfp, port_uhd_mpo, `${PORT_MPO}-${PORT_SFP} (10G)`];
                 }
             } else {
                   console.warn(`警告: _find_best_single_link 中 MPO-SFP 端口副本占用失败 ${uhdDevCopy.name}[${port_uhd_mpo}] 或 ${micronDevCopy.name}[${port_micron_sfp}]`);
                  if (port_uhd_mpo in uhdDevCopy.portConnections) uhdDevCopy.returnPort(port_uhd_mpo);
                  if (port_micron_sfp in micronDevCopy.portConnections) micronDevCopy.returnPort(port_micron_sfp);
             }
        }
    }

    // --- 没有找到任何兼容的可用连接 ---
    // console.log(`_find_best_single_link: 未找到 ${dev1Copy.name} 和 ${dev2Copy.name} 之间的可用连接`);
    return [null, null, null];
}

     /**
      * 计算 Mesh 连接方案。
      * 此方法不修改 NetworkManager 的状态，仅返回计算出的连接列表。
      * @returns {Array<Array>} 计算出的 Mesh 连接元组列表 [[dev1, port1, dev2, port2, connTypeStr], ...]
      */
     calculate_mesh() {
        if (this.devices.length < 2) {
            console.log("计算 Mesh：设备数量少于 2，无需计算。");
            return [];
        }

        console.log("开始计算 Mesh 连接...");
        const calculatedConnections = [];
        // --- 使用设备的深拷贝进行计算 ---
        const tempDevices = this.devices.map(dev => dev.clone()); // 使用我们添加的 clone 方法
        const deviceMap = tempDevices.reduce((map, dev) => {
            map[dev.id] = dev;
            return map;
        }, {});
        // ---------------------------------

        const allDeviceIds = tempDevices.map(dev => dev.id);
        const allPairsIds = this._generateCombinations(allDeviceIds, 2); // 获取所有设备对 ID

        const connectedOncePairs = new Set(); // 记录至少连接过一次的设备对 (使用排序后的 ID 元组作为键)

        console.log("Mesh Phase 1: 尝试为每个设备对建立第一条连接...");
        let madeProgressPhase1 = true;
        let failedPairsPhase1Info = []; // 记录 Phase 1 失败的对

        // --- Phase 1: 确保每对设备至少连接一次 ---
        while (madeProgressPhase1) {
            madeProgressPhase1 = false;
            allPairsIds.forEach(([dev1Id, dev2Id]) => {
                const pairKey = JSON.stringify([dev1Id, dev2Id].sort()); // 用排序后的 JSON 字符串作为 Set 的键
                if (!connectedOncePairs.has(pairKey)) {
                    const dev1Copy = deviceMap[dev1Id];
                    const dev2Copy = deviceMap[dev2Id];

                    // 注意：_find_best_single_link 会修改 dev1Copy 和 dev2Copy 的状态 (占用端口)
                    const [port1, port2, connType] = this._find_best_single_link(dev1Copy, dev2Copy);

                    if (port1 && port2 && connType) {
                        // 获取原始设备对象用于添加到结果列表
                        const originalDev1 = this.getDeviceById(dev1Id);
                        const originalDev2 = this.getDeviceById(dev2Id);
                        if (originalDev1 && originalDev2) {
                            // 确保返回的元组中设备顺序与找到的端口对应
                            // _find_best_single_link 返回的是 [portOnDev1Copy, portOnDev2Copy, type]
                            calculatedConnections.push([originalDev1, port1, originalDev2, port2, connType]);
                            connectedOncePairs.add(pairKey);
                            madeProgressPhase1 = true; // 标记本轮有进展
                            console.log(`  Phase 1: 添加连接 ${originalDev1.name}[${port1}] <-> ${originalDev2.name}[${port2}]`);
                        } else {
                             console.error(`严重错误: Mesh Phase 1 中找不到原始设备对象 ID ${dev1Id} 或 ${dev2Id}`);
                        }
                    } else {
                         // 记录第一次尝试失败的对的信息（只记录一次）
                         if (!failedPairsPhase1Info.some(item => item.key === pairKey)) {
                             const originalDev1 = this.getDeviceById(dev1Id);
                             const originalDev2 = this.getDeviceById(dev2Id);
                             const pairName = (originalDev1 && originalDev2) ? `${originalDev1.name} <-> ${originalDev2.name}` : `ID ${dev1Id} <-> ID ${dev2Id}`;
                             failedPairsPhase1Info.push({ key: pairKey, name: pairName });
                         }
                    }
                }
            });
            if (!madeProgressPhase1) break; // 如果一轮没有任何进展，退出 Phase 1
        }

        if (connectedOncePairs.size < allPairsIds.length) {
            const failedPairNames = failedPairsPhase1Info
               .filter(item => !connectedOncePairs.has(item.key))
               .map(item => item.name);
            console.warn(`警告: Mesh Phase 1 未能为所有设备对建立连接。失败 ${allPairsIds.length - connectedOncePairs.size} 对: ${failedPairNames.join(', ')}`);
        }
        console.log(`Mesh Phase 1 完成. 建立了 ${calculatedConnections.length} 条初始连接。`);


        console.log("Mesh Phase 2: 填充剩余端口...");
        // --- Phase 2: 填充剩余端口 ---
        let connectionMadeInFullPassPhase2 = true;
        while (connectionMadeInFullPassPhase2) {
            connectionMadeInFullPassPhase2 = false;
            // 稍微打乱顺序尝试不同的连接可能性
            this._shuffleArray(allPairsIds);

            allPairsIds.forEach(([dev1Id, dev2Id]) => {
                const dev1Copy = deviceMap[dev1Id];
                const dev2Copy = deviceMap[dev2Id];
                const [port1, port2, connType] = this._find_best_single_link(dev1Copy, dev2Copy);

                if (port1 && port2 && connType) {
                    const originalDev1 = this.getDeviceById(dev1Id);
                    const originalDev2 = this.getDeviceById(dev2Id);
                     if (originalDev1 && originalDev2) {
                        calculatedConnections.push([originalDev1, port1, originalDev2, port2, connType]);
                        connectionMadeInFullPassPhase2 = true; // 标记本轮有进展
                        console.log(`  Phase 2: 添加连接 ${originalDev1.name}[${port1}] <-> ${originalDev2.name}[${port2}]`);
                     } else {
                        console.error(`严重错误: Mesh Phase 2 中找不到原始设备对象 ID ${dev1Id} 或 ${dev2Id}`);
                     }
                }
            });
        }

        console.log(`Mesh Phase 2 完成. 总计算连接数: ${calculatedConnections.length}`);
        return calculatedConnections;
    }

        /**
     * 辅助函数：生成数组元素的所有组合 (类似 Python itertools.combinations)
     * @param {Array} arr - 输入数组
     * @param {number} k - 组合大小
     * @returns {Array<Array>} 所有组合的数组
     */
        _generateCombinations(arr, k) {
            const result = [];
            const n = arr.length;
            if (k < 0 || k > n) {
                return result;
            }
            if (k === 0) {
                result.push([]);
                return result;
            }
    
            function backtrack(start, currentCombination) {
                if (currentCombination.length === k) {
                    result.push([...currentCombination]);
                    return;
                }
                for (let i = start; i < n; i++) {
                    currentCombination.push(arr[i]);
                    backtrack(i + 1, currentCombination);
                    currentCombination.pop();
                }
            }
    
            backtrack(0, []);
            return result;
        }
    
        /**
         * 辅助函数：原地打乱数组 (Fisher-Yates Shuffle)
         * @param {Array} array - 要打乱的数组
         */
        _shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]]; // Swap elements
            }
        }
    

// js/networkManager.js
// ... (class NetworkManager, constructor, 设备管理方法, 连接管理方法, _find_best_single_link, calculate_mesh, 辅助函数等保持不变) ...

     /**
      * 计算 Ring 连接方案。
      * 此方法不修改 NetworkManager 的状态，仅返回计算出的连接列表和错误信息。
      * @returns {[Array<Array>, string|null]} 返回 [计算出的 Ring 连接列表, 错误信息字符串 或 null]
      */
     calculate_ring() {
        const numDevices = this.devices.length;
        if (numDevices < 2) {
            console.log("计算 Ring：设备数量少于 2，无法形成环形。");
            return [[], "设备数量少于 2，无法形成环形"];
        }

        console.log("开始计算 Ring 连接...");

        // 处理两个设备的特殊情况（退化为 Mesh）
        if (numDevices === 2) {
            console.log("设备数量为 2，使用 Mesh 逻辑计算连接。");
            const meshConns = this.calculate_mesh(); // 调用已实现的 Mesh 计算
            return [meshConns, null]; // 两个设备总能（尝试）连接，不算错误
        }

        const calculatedConnections = [];
        // --- 使用设备的深拷贝进行计算 ---
        const tempDevices = this.devices.map(dev => dev.clone());
        const deviceMap = tempDevices.reduce((map, dev) => {
            map[dev.id] = dev;
            return map;
        }, {});
        // ---------------------------------

        // 按 ID 排序以确保环连接顺序一致
        const sortedDeviceIds = tempDevices.map(dev => dev.id).sort((a, b) => a - b);

        const linkEstablished = new Array(numDevices).fill(true); // 标记每个连接段是否成功
        const failedSegmentsInfo = []; // 记录失败的段落信息

        for (let i = 0; i < numDevices; i++) {
            const dev1Id = sortedDeviceIds[i];
            const dev2Id = sortedDeviceIds[(i + 1) % numDevices]; // 连接到下一个，最后一个连回第一个

            const dev1Copy = deviceMap[dev1Id];
            const dev2Copy = deviceMap[dev2Id];

            const [port1, port2, connType] = this._find_best_single_link(dev1Copy, dev2Copy);

            if (port1 && port2 && connType) {
                // 获取原始设备对象用于添加到结果列表
                const originalDev1 = this.getDeviceById(dev1Id);
                const originalDev2 = this.getDeviceById(dev2Id);
                if (originalDev1 && originalDev2) {
                    // 确保返回的元组中设备顺序与找到的端口对应
                    calculatedConnections.push([originalDev1, port1, originalDev2, port2, connType]);
                    console.log(`  Ring: 添加连接 ${originalDev1.name}[${port1}] <-> ${originalDev2.name}[${port2}]`);
                } else {
                     console.error(`严重错误: Ring 计算中找不到原始设备对象 ID ${dev1Id} 或 ${dev2Id}`);
                     linkEstablished[i] = false; // 标记此段失败
                     failedSegmentsInfo.push(`ID ${dev1Id} <-> ID ${dev2Id} (对象丢失)`);
                }
            } else {
                // 连接失败
                linkEstablished[i] = false;
                const originalDev1 = this.getDeviceById(dev1Id);
                const originalDev2 = this.getDeviceById(dev2Id);
                const segmentName = (originalDev1 && originalDev2) ? `${originalDev1.name} <-> ${originalDev2.name}` : `ID ${dev1Id} <-> ID ${dev2Id}`;
                failedSegmentsInfo.push(segmentName);
                console.warn(`警告: 无法在 ${segmentName} 之间建立环形连接段。`);
            }
        }

        let errorMessage = null;
        if (!linkEstablished.every(status => status === true)) {
            errorMessage = `未能完成完整的环形连接。无法连接的段落：${failedSegmentsInfo.join(', ')}。`;
            console.warn(`Ring 计算警告: ${errorMessage}`);
        }

        console.log(`Ring 计算完成. 计算连接数: ${calculatedConnections.length}`);
        return [calculatedConnections, errorMessage];
        }
 
           /**
     * 内部辅助函数：使用指定风格（Mesh 或 Ring）填充当前状态下的剩余端口。
     * 这个方法 *会* 修改 NetworkManager 的状态 (this.connections 和 device 状态)。
     * @param {string} style - 填充风格，'mesh' 或 'ring'。
     * @returns {Array<Array>} 新添加的连接列表 [[dev1, port1, dev2, port2, connTypeStr], ...]
     */
    _fill_connections_style(style = 'mesh') {
        if (this.devices.length < 2) {
            return [];
        }

        console.log(`开始填充剩余连接 (${style} 风格)...`);
        const newlyAddedConnections = [];
        const allDeviceIds = this.devices.map(dev => dev.id);

        let connectionMadeInFullPass = true;
        while (connectionMadeInFullPass) {
            connectionMadeInFullPass = false;
            let pairsToTry = [];

            if (style === 'mesh') {
                // Mesh 风格：尝试所有设备对
                pairsToTry = this._generateCombinations(allDeviceIds, 2);
                this._shuffleArray(pairsToTry); // 随机化尝试顺序
            } else { // style === 'ring'
                // Ring 风格：只尝试相邻设备对（基于排序后的 ID）
                const sortedIds = [...allDeviceIds].sort((a, b) => a - b);
                for (let i = 0; i < sortedIds.length; i++) {
                    pairsToTry.push([sortedIds[i], sortedIds[(i + 1) % sortedIds.length]]);
                }
                // Ring 风格通常不需要随机化，按顺序填充即可
            }

            pairsToTry.forEach(([dev1Id, dev2Id]) => {
                const dev1 = this.getDeviceById(dev1Id);
                const dev2 = this.getDeviceById(dev2Id);

                if (!dev1 || !dev2 || dev1Id === dev2Id) return; // 跳过无效或相同的设备

                // --- 关键：探测可用连接 ---
                // 为了探测，我们需要不修改原始状态的查找方式
                // 方案A: 临时修改 _find_best_single_link，让它不修改副本状态（复杂）
                // 方案B: 在这里创建副本进行探测 (更安全)
                const dev1Copy = dev1.clone();
                const dev2Copy = dev2.clone();
                // 传入副本进行探测，_find_best_single_link 会修改副本状态，但不影响原始 dev1, dev2
                const [port1Probe, port2Probe, connTypeProbe] = this._find_best_single_link(dev1Copy, dev2Copy);

                if (port1Probe && port2Probe && connTypeProbe) {
                    // 探测成功！现在尝试在 *真实* 设备上添加连接
                    // 注意：需要确保 add_connection 检查端口在真实设备上是否确实可用
                    // （理论上应该可用，因为我们只修改了副本）
                    console.log(`  填充探测到可用连接: ${dev1.name}[${port1Probe}] <-> ${dev2.name}[${port2Probe}]`);
                    const addedConnection = this.add_connection(dev1Id, port1Probe, dev2Id, port2Probe);
                    if (addedConnection) {
                        newlyAddedConnections.push(addedConnection);
                        connectionMadeInFullPass = true; // 成功添加，可能还有更多
                        console.log(`  填充成功添加连接: ${dev1.name}[${port1Probe}] <-> ${dev2.name}[${port2Probe}]`);
                    } else {
                         // 即使探测成功，实际添加也可能因为某种原因失败（例如并发问题，虽然在单线程 JS 中不太可能）
                         console.warn(`  填充警告: 探测到连接但添加到管理器失败: ${dev1.name}[${port1Probe}] <-> ${dev2.name}[${port2Probe}]`);
                    }
                }
            });
        } // end while

        console.log(`填充完成 (${style} 风格). 新增连接数: ${newlyAddedConnections.length}`);
        return newlyAddedConnections;
 
    }

    /**
     * 使用 Mesh 风格填充剩余端口。
     * @returns {Array<Array>} 新添加的连接列表。
     */
    fill_connections_mesh() {
        return this._fill_connections_style('mesh');
    }

    /**
     * 使用 Ring 风格填充剩余端口。
     * @returns {Array<Array>} 新添加的连接列表。
     */
    fill_connections_ring() {
        return this._fill_connections_style('ring');
    }

      /**
       * 添加最佳连接（用于拖拽）
       * @param {number} dev1Id
       * @param {number} dev2Id
       * @returns {Array|null}
       */
       add_best_connection(dev1Id, dev2Id) {
            // TODO: 实现拖拽连接逻辑
            // 1. 获取设备
            // 2. (可选) 深拷贝
            // 3. 调用 _find_best_single_link 探测
            // 4. 调用 add_connection 添加
            console.warn("add_best_connection 尚未实现");
            return null;
       }

       // ... 可能需要的其他辅助函数 ...
       /**
        * 获取设备的可用端口
        * @param {number} deviceId
        * @returns {Array<string>}
        */
       getAvailablePorts(deviceId) {
           const device = this.getDeviceById(deviceId);
           return device ? device.getAllAvailablePorts() : [];
       }
}