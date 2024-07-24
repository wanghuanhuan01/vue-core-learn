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
    $set(target, key, value) {
        // 4. 调用$set时，把新的属性也设置成响应式的
        defineReactive(target, key, value);
        // 5. 执行notify方法，更新数据
        target.__ob__.dep.notify();
    }
}
function observe(data) {
    const type = Object.prototype.toString.call(data);
    if (type !== '[object Object]' && type !== '[object Array]') return;
    if (data.__ob__) {
        return data.__ob__;
    }
    return new Observer(data);
}

function defineReactive(obj, key, value) {
    let childObj = observe(obj[key]);
    console.log('childObj', childObj)
    let dep = new Dep();
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter() {
            dep.depend();
            // 3. 触发get时，进行依赖收集
            if (childObj) {
                childObj.dep.depend();
            }
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
        // 1. Observer实例上也创建一个dep对象，用于依赖收集
        this.dep = new Dep();
        if (Array.isArray(data)) {
            data.__proto__ = ArrayMethods;
            // 如果数组中有对象，需要遍历数组中的每一项，把对象也变成响应式的
            this.observeArray(data);
        } else {
            // Object.defineProperty劫持数组会存在问题，所以如果是数组就不走walk方法
            this.walk(data);
        }
        // 2. 给data创建一个__ob__属性，模拟vue中data的__ob__属性
        Object.defineProperty(data, '__ob__', {
            value: this,
            enumerable: false,
            configurable: true,
            writable: true,
        })
    }
    observeArray(arr) {
        for (let i = 0; i < arr.length; i++) {
            observe(arr[i]);
        }
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

const ArrayMethods = {};
// 1. 不要直接改变数组原型上的方法，这样会影响到原有数组的方法
// 可以在数组原型上插入一个自定义对象，对数组方法进行拦截
// 保证原有数组方法不会受影响的前提，调用notify方法手动更新数组
ArrayMethods.__proto__ = Array.prototype;
const methods = ['push', 'pop'];
methods.forEach(method => {
    ArrayMethods[method] = function (...args) {
        const result = Array.prototype[method].apply(this, args);
        // 如果push的是一个对象，也需要把对象变成响应式的
        if (method === 'push') {
            this.__ob__.observeArray(args);
        }
        this.__ob__.dep.notify();
        return result;
    }
})

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
