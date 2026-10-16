# RESEARCH v1.1：网格背包 / 实验室空间摆放 开源调研

> 只借鉴范式，不复制代码。数据来自 GitHub API（2026 检索，stars 为检索时数值）。项目是原生 JS（src/core + src/data + src/ui），以下都翻译成 JS 可落地的形状。

## 1. 候选项目

| 项目 | 许可证 | 栈 | 可借鉴点 |
| --- | --- | --- | --- |
| [Cholopol/Cholopol-Tetris-Inventory-System](https://github.com/Cholopol/Cholopol-Tetris-Inventory-System) (74★) | Apache-2.0 | Godot/C# | 数据与 UI 彻底分离（MVVM）；纯几何库处理多格形状、旋转、嵌套容器；Tarkov 式“快速交换” |
| [SinlessDevil/TetrisInventorySystem](https://github.com/SinlessDevil/TetrisInventorySystem) (47★) | MIT | Unity/C# | 自动放置（找第一个空位）、拖到删除区丢弃、动画期间锁交互、调试按钮 |
| [Hexadotz/grid-based-inventory-system](https://github.com/Hexadotz/grid-based-inventory-system) (22★) | MIT | Godot/GDScript | 物品定义集中在 ItemDB；堆叠、交换、旋转、存档/读档四件套 |
| [inurentto/grid-pack](https://github.com/inurentto/grid-pack) (24★) | MIT | Roblox/Lua | 把“网格”和“物品”做成独立对象，多个网格之间可拖拽转移 |
| [plneappl/backpack-battles-planner](https://github.com/plneappl/backpack-battles-planner) | AGPL-3.0 | Next.js/TS | Backpack Battles 摆放规划器，Web 端拖拽棋盘交互参考（AGPL：只看交互，严禁搬代码） |
| [ottoblep/backpack-battles-solver](https://github.com/ottoblep/backpack-battles-solver) | 无许可证 | C++ | 把摆放当作优化问题（random / greedy 搜索）；无许可证 = 不可复用，只取思路 |

## 2. 共性数据结构（建议直接用于评院士）

```js
// 物品定义（放 src/data，纯数据）
{ id: 'cryo_em', name: '冷冻电镜', shape: [[0,0],[1,0],[0,1],[1,1]], // 相对格坐标
  tags: ['仪器','大型'], adjacency: { tag: '学生', bonus: { 产出: +1 } } }

// 布局状态（放 state，可存档）
lab: { w: 6, h: 4, placed: [{ uid, defId, x, y, rot }] }
```

- 占用判断不存二维数组，存 placed 列表，按需派生 occupancy（`Map<"x,y", uid>`）。存档小、无同步 bug（Cholopol / Hexadotz 均是“列表为真，网格为派生”）。
- 旋转：rot∈{0,1,2,3}，shape 坐标 (x,y)→(-y,x) 后归一化到最小 x/y=0。
- canPlace(def, x, y, rot)：越界 或 任一格已被占 → false。纯函数，放 src/core/rules 或新 lab.js，便于测试。
- 相邻加成（Backpack Hero / Battles 核心乐趣）：遍历物品格的四邻，汇总邻居 tags，按 def.adjacency 结算。结算放 selectors（派生），不进存档。

## 3. 交互范式（按 1 小时可交付排序）

1. 点选放置（优先）：点仓库物品 → 进入“手持”状态 → 悬停网格显示绿/红预览 → 点击落下；R 键或按钮旋转；Esc 取消。比 HTML5 拖拽更稳、移动端可用、键盘可达。
2. 自动放置：仓库物品“一键放入”，扫描第一个 canPlace 的位置（SinlessDevil）。放不下给出明确文案。
3. 拿起/移回仓库：点已放置物品 → 回到手持；放到仓库区 = 收回（替代“删除区”）。
4. 预览反馈：合法格高亮、冲突格标红、相邻加成用小图标/数字浮在格上（Backpack Battles 的“星星连线”简化版）。
5. 交互锁：结算/弹窗期间禁止摆放（SinlessDevil 的 interaction lock），避免状态竞态。
6. 暂不做：容器嵌套、物品堆叠、拖拽动画、求解器——收益低、时间盒内风险高。

## 4. 合规备注

- MIT / Apache-2.0 项目可参考设计；本次不复制任何代码，无需附带 NOTICE。
- AGPL 与无许可证仓库只做交互观察，代码一行不碰。
- 所有借鉴均为通用游戏范式（多格物品、旋转、相邻加成），不构成具体表达的复制。
