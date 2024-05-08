class Vue {
    constructor(options) {
        this.$options = options;
        this._data = options.data;
        this.initData();
    }
    initData() {
        let data = this._data;
        // todo 暂时不考虑data是函数的情况
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            Object.defineProperty(this, keys[i], {
                enumerable: true, // 可遍历
                configurable: true, // 可删除
                get: function proxyGetter() {
                    return data[keys[i]];
                },
                set: function proxySetter(value) {
                    data[keys[i]] = value;
                }
            });
        }
    }
}