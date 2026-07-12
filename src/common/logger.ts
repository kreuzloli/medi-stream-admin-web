/**
 * 管理端统一日志入口。
 *
 * 日志仅用于记录关键状态和故障上下文。调用方不得传入密码、Token、请求体等敏感信息。
 */
class Logger {
    private readonly prefix = '[Medi Stream Admin]';

    /** 记录正常业务状态变化，例如登录成功或路由切换。 */
    info(message: string, context?: Record<string, unknown>): void {
        this.write(console.info, message, context);
    }

    /** 记录可恢复的异常状态，例如登录失败或会话过期。 */
    warn(message: string, context?: Record<string, unknown>): void {
        this.write(console.warn, message, context);
    }

    /** 记录阻断页面继续工作的系统异常。 */
    error(message: string, context?: Record<string, unknown>): void {
        this.write(console.error, message, context);
    }

    /** 保持所有日志格式一致，并避免输出无意义的空对象。 */
    private write(
        output: (message?: unknown, ...optionalParams: unknown[]) => void,
        message: string,
        context?: Record<string, unknown>,
    ): void {
        const text = `${this.prefix} ${message}`;
        if (context && Object.keys(context).length > 0) {
            output(text, context);
            return;
        }
        output(text);
    }
}

export const logger = new Logger();
