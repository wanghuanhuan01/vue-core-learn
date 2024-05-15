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
        observe(data);
    }
}
function observe(data) {
    const type = Object.prototype.toString.call(data);
    if (type !== '[object Object]' && type !== '[object Array]') return;
    new Observer(data);
}

function defineReactive(obj, key, value) {
    observe(obj[key]);
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter() {
            console.log(`读取${key}的值`)
            return value;
        },
        set: function reactiveSetter(val) {
            if (val === value) return;
            console.log(`${key}的值发生了变化`);
            value = val;
        }
    })
}
class Observer {
    constructor(data) {
        this.walk(data);
    }
    walk(data) {
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            defineReactive(data, keys[i], data[keys[i]]);
        }
    }
}
