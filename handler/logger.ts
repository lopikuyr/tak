type ColorCode = typeof colors[keyof typeof colors];
type LogFunction = (...messages: any[]) => void;

// ANSI color codes as const to ensure type safety
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
} as const;

// Interface for our logger
interface Logger {
    // Basic color logs
    redLog: LogFunction;
    yellowLog: LogFunction;
    greenLog: LogFunction;

    // Semantic logs
    errorLog: LogFunction;
    warningLog: LogFunction;
    successLog: LogFunction;
    infoLog: LogFunction;

    // Colors object for custom usage
    colors: typeof colors;
}

// Create colored log factory function
const createColoredLog = (color: ColorCode): LogFunction => {
    return (...messages: any[]): void => {
        console.log(color, ...messages, colors.reset);
    };
};

// Create semantic log factory function
const createSemanticLog = (color: ColorCode, prefix: string): LogFunction => {
    return (...messages: any[]): void => {
        console.log(color, prefix, ...messages, colors.reset);
    };
};

// Create and export the logger object
const logger: Logger = {
    // Basic color logs
    redLog: createColoredLog(colors.red),
    yellowLog: createColoredLog(colors.yellow),
    greenLog: createColoredLog(colors.green),

    // Semantic logs
    errorLog: createSemanticLog(colors.red, '❌ ERROR:'),
    warningLog: createSemanticLog(colors.yellow, '⚠️ WARNING:'),
    successLog: createSemanticLog(colors.green, '✅ SUCCESS:'),
    infoLog: createSemanticLog(colors.blue, 'ℹ️ INFO:'),

    // Export colors for custom usage
    colors
};

export default logger;
