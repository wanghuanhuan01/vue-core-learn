class Vue {
    constructor(options) {
        this.$options = options;
        this._data = options.data;
        this.initData();
        this.initComputed();
        this.initWatch();
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
    // 初始化计算属性:
    //     1. 计算属性本质也是一个Watcher
    //     2. 计算属性只能取值，不能修改值，所以计算属性本身不需要依赖收集，计算属性更新的前提是其所依赖的属性发生改变
    //     3. 计算属性是惰性的，当所依赖的属性发生变化时，计算属性不会立即重新计算，需要等到重新对计算属性进行求值时才会计算
    //     4. 计算属性是缓存的，只有当依赖的属性发生变化时，计算属性才会更新
    initComputed() {
        let computed = this.$options.computed;
        if (computed) {
            const keys = Object.keys(computed);
            for (let i = 0; i < keys.length; i++) {
                const watcher = new Watcher(this, computed[keys[i]], function() {}, { lazy: true });
                Object.defineProperty(this, keys[i], {
                    enumerable: true,
                    configurable: true,
                    get: function computedGetter() {
                        // todo: 这里为啥还要调一次get？？
                        if (watcher.dirty) {
                            watcher.get();
                            watcher.dirty = false;
                        }
                        if (Dep.target) {
                            for (let j = 0; j < watcher.deps.length; j++) {
                                watcher.deps[j].depend();
                            }
                        }
                        return watcher.value;
                    },
                    set: function computedSetter() {
                        console.warn('不能修改计算属性的值')
                    },
                });
            }
        }
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
let targetStack = []
class Dep {
    constructor() {
        this.subs = [];
    }
    // 依赖收集
    addSub(watcher) {
        this.subs.push(watcher);
    }
    depend() {
        if (Dep.target) {
            Dep.target.addDep(this);
        }
    }
    notify() {
        this.subs.forEach((watcher) => {
            watcher.update();
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
    constructor(vm, exp, cb, options = {}) {
        // 初始化lazy属性和dirty属性
        this.dirty = this.lazy = !!options.lazy;
        this.vm = vm;
        this.exp = exp;
        this.cb = cb;
        this.id = ++watcherId;
        this.deps = [];
        // 如果不是lazy watcher,就直接执行get
        if (!this.lazy) this.get();
    }
    // Watcher和Dep的双向收集，这里收集dep是为了1号watcher(计算属性)收集完成下台后，这些dep也能一起收集台上的2号watcher
    // 注：因为触发2号watcher时，也会触发1号watcher，如果1号watcher被收集后执行完get下台，此时的Dep.target被置空了，留在台上的2号watcher就会没人收集，导致2号watcher一直不会被触发
    addDep(dep) {
        if (this.deps.indexOf(dep) !== -1) {
            return;
        }
        this.deps.push(dep);
        dep.addSub(this);
    }
    get() {
        Dep.target = this;
        // targetStack：使用栈的概念，新的watcher后进就先出，保证栈顶的永远是在台上的（需要被收集的）watcher
        targetStack.push(this);
        if (typeof this.exp === 'function') {
            this.value = this.exp.call(this.vm);
        } else {
            this.value = this.vm[this.exp];
        }
        targetStack.pop();
        // 如果此时栈的长度不为0，表示栈里还有watcher（即台上的watcher），此时不置空Dep.target,而是把此时台上的watcher实例赋值给Dep.target
        if (targetStack.length > 0) {
            Dep.target = targetStack[targetStack.length - 1];
        } else {
            Dep.target = null;
        }
    }
    update() {
        // 如果是lazy watcher，先把dirty属性置为true,不执行run的更新操作，等到下一次访问计算属性时再触发
        if (this.lazy) {
            this.dirty = true;
        } else {
            this.run();
        }
    }
    run() {
        // 如果已经存在监听队列中，就不执行回调
        if (watcherQueue.indexOf(this.id) !== -1) return;
        watcherQueue.push(this.id);
        Promise.resolve().then(() => {
            this.get();
            // 绑定需要监听的对象的this
            this.cb.call(this.vm);
            const index = watcherQueue.indexOf(this.id)
            watcherQueue.splice(index, 1)
        });
    }
}
