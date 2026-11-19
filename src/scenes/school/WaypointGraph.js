import * as THREE from 'three';

/**
 * Đồ thị waypoint đọc từ data/waypoints.json: { "tên": { position: [x,y,z], links: ["tên khác"] } }.
 * Liên kết được coi là hai chiều để người dùng luôn quay lại được.
 */
export class WaypointGraph {
  constructor(json) {
    this.nodes = new Map();
    for (const [id, wp] of Object.entries(json)) {
      this.nodes.set(id, { id, position: new THREE.Vector3(...wp.position), links: new Set() });
    }
    for (const [id, wp] of Object.entries(json)) {
      for (const other of wp.links || []) {
        if (!this.nodes.has(other) || other === id) continue;
        this.nodes.get(id).links.add(other);
        this.nodes.get(other).links.add(id);
      }
    }
    this.first = this.nodes.keys().next().value;
  }

  get(id) {
    return this.nodes.get(id);
  }

  neighbors(id) {
    return [...(this.nodes.get(id)?.links ?? [])].map((n) => this.nodes.get(n));
  }

  /** Đường đi ngắn nhất (theo số bước) từ `from` tới `to`, gồm cả hai đầu. null nếu không tới được. */
  path(from, to) {
    if (from === to) return [from];
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const id = queue.shift();
      for (const next of this.nodes.get(id)?.links ?? []) {
        if (prev.has(next)) continue;
        prev.set(next, id);
        if (next === to) {
          const out = [to];
          for (let p = id; p !== null; p = prev.get(p)) out.unshift(p);
          return out;
        }
        queue.push(next);
      }
    }
    return null;
  }

  /** Waypoint gần một điểm nhất. */
  nearest(point) {
    let best = null;
    let bestD = Infinity;
    for (const node of this.nodes.values()) {
      const d = node.position.distanceToSquared(point);
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  }
}
