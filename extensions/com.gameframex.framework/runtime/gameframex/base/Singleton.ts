/**
 * 泛型单例 Mixin(与 LayaBox/Godot 版同契约)。
 *
 * 用法:`class Manager extends Singleton<MyManager>() { ... }`,
 * 通过 `Manager.instance` 获取唯一实例;构造器受保护,禁止外部 new。
 */
export default function Singleton<T>() {
    class SingletonT {
        protected constructor() {}
        private static _instance: SingletonT | null = null;
        /**
         * 单例对象
         */
        public static get instance(): T {
            if (SingletonT._instance == null) {
                SingletonT._instance = new this();
            }
            return SingletonT._instance as T;
        }
    }
    return SingletonT;
}
