export class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.indices = new Set();
    this.parent = null; // Add parent reference for deletion
  }
}

export class Trie {
  constructor(caseSensitive = false) {
    this.root = new TrieNode();
    this.caseSensitive = caseSensitive;
  }

  _processWord(word) {
    return this.caseSensitive ? word : word.toLowerCase();
  }

  insert(word, index) {
    let current = this.root;
    const processedWord = this._processWord(word);

    for (const char of processedWord) {
      if (!current.children.has(char)) {
        const newNode = new TrieNode();
        newNode.parent = current;
        current.children.set(char, newNode);
      }
      current = current.children.get(char);
      current.indices.add(index);
    }
    current.isEndOfWord = true;
  }

  delete(word, index) {
    let current = this.root;
    const processedWord = this._processWord(word);
    const path = [current];

    for (const char of processedWord) {
      if (!current.children.has(char)) {
        return false;
      }
      current = current.children.get(char);
      path.push(current);
    }

    if (!current.isEndOfWord) {
      return false;
    }

    current.indices.delete(index);

    // Remove empty nodes
    for (let i = path.length - 1; i > 0; i--) {
      const node = path[i];
      if (node.indices.size === 0 && node.children.size === 0) {
        const parent = path[i - 1];
        const char = processedWord[i - 1];
        parent.children.delete(char);
      }
    }

    return true;
  }

  findPrefix(prefix, exact = false) {
    let current = this.root;
    const processedPrefix = this._processWord(prefix);

    for (const char of processedPrefix) {
      if (!current.children.has(char)) {
        return new Set();
      }
      current = current.children.get(char);
    }

    if (exact && !current.isEndOfWord) {
      return new Set();
    }

    return current.indices;
  }

  searchWords(prefix) {
    let current = this.root;
    const processedPrefix = this._processWord(prefix);
    const results = new Set();

    for (const char of processedPrefix) {
      if (!current.children.has(char)) {
        return results;
      }
      current = current.children.get(char);
    }

    this._collectWords(current, results);
    return results;
  }

  _collectWords(node, results) {
    if (node.isEndOfWord) {
      node.indices.forEach((index) => results.add(index));
    }

    for (const child of node.children.values()) {
      this._collectWords(child, results);
    }
  }
}
