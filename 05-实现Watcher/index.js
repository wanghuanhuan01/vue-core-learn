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
        this.initWatch();
    }
    initWatch() {
        let watch = this.$options.watch;
        if (watch) {
            const keys = Object.keys(watch);
            for (let i = 0; i < keys.length; i++) {
                this.$watch(keys[i], watch[keys[i]])
            }
        }
    }
    $watch(key, cb) {
        new Watcher(this, key, cb)
    }
}
function observe(data) {
    const type = Object.prototype.toString.call(data);
    if (type !== '[object Object]' && type !== '[object Array]') return;
    new Observer(data);
}

function defineReactive(obj, key, value) {
    observe(obj[key]);
    let dep = new Dep();
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter() {
            dep.depend();
            return value;
        },
        set: function reactiveSetter(val) {
            if (val === value) return;
            dep.notify();
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
class Dep {
    constructor() {
        this.subs = [];
    }
    depend() {
        if (Dep.target) {
            this.subs.push(Dep.target);
        }
    }
    notify() {
        this.subs.forEach((watcher) => {
            watcher.run();
        })
    }
}

let watcherId = 0, watcherQueue = [];
class Watcher {
    constructor(vm, exp, cb) {
        this.vm = vm;
        this.exp = exp;
        this.cb = cb;
        this.id = ++watcherId;
        this.get();
    }
    get() {
        Dep.target = this;
        this.vm[this.exp];
        Dep.target = null;
    }
    run() {
        // 如果已经存在监听队列中，就不执行回调
        if (watcherQueue.indexOf(this.id) !== -1) return;
        watcherQueue.push(this.id);
        Promise.resolve().then(() => {
            // 绑定需要监听的对象的this
            this.cb.call(this.vm);
            const index = watcherQueue.indexOf(this.id)
            watcherQueue.splice(index, 1)
        });
    }
}
