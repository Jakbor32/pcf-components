import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";

type ToastVariant = "info" | "success" | "warning" | "error";
type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";
type ToastSize = "sm" | "md" | "lg";
type IconPosition = "left" | "right";
type IconSet = "emoji" | "minimal" | "bold";
interface RawValueProperty {
    raw?: unknown;
}

interface ToastItem {
    id: number;
    message: string;
    variant: ToastVariant;
    durationMs: number;
    remainingMs: number;
    isExiting: boolean;
    isPaused: boolean;
    timerStartedAt?: number;
    timeoutId?: number;
    exitTimeoutId?: number;
}

interface ToastHostProps {
    toasts: ToastItem[];
    position: ToastPosition;
    isBottom: boolean;
    size: ToastSize;
    iconPosition: IconPosition;
    styleVars: React.CSSProperties;
    icons: Record<ToastVariant, string>;
    onClose: (id: number) => void;
    onPause: (id: number) => void;
    onResume: (id: number) => void;
}

const ICON_SETS: Record<IconSet, Record<ToastVariant, string>> = {
    emoji: {
        info: "ℹ",
        success: "✔",
        warning: "⚠",
        error: "✖",
    },
    minimal: {
        info: "i",
        success: "ok",
        warning: "!",
        error: "x",
    },
    bold: {
        info: "i",
        success: "✓",
        warning: "!",
        error: "×",
    },
};

const ToastHost = (props: ToastHostProps): React.ReactElement => {
    const containerClass = `hot-toast-container hot-toast-container--${props.position} ${props.isBottom ? "hot-toast-container--bottom" : ""}`;
    const orderedToasts = props.isBottom ? [...props.toasts].reverse() : props.toasts;
    const children = orderedToasts.map((toast) => {
        const toastClass = `hot-toast hot-toast--${toast.variant} hot-toast--${props.size} hot-toast--icon-${props.iconPosition} ${props.isBottom ? "hot-toast--bottom" : ""} ${toast.isExiting ? "hot-toast--exit" : "hot-toast--enter"}`;
        return React.createElement(
            "div",
            {
                key: toast.id,
                className: toastClass,
                "data-paused": toast.isPaused ? "true" : "false",
                style: props.styleVars,
                onMouseEnter: () => props.onPause(toast.id),
                onMouseLeave: () => props.onResume(toast.id),
            },
            [
                React.createElement(
                    "div",
                    { key: "icon", className: "hot-toast__icon", "aria-hidden": true },
                    props.icons[toast.variant]
                ),
                React.createElement(
                    "div",
                    { key: "message", className: "hot-toast__message" },
                    toast.message
                ),
                React.createElement(
                    "div",
                    {
                        key: "progress",
                        className: "hot-toast__progress",
                        style: {
                            animationDuration: `${toast.durationMs}ms`,
                            animationPlayState: toast.isPaused ? "paused" : "running",
                        },
                    }
                ),
                React.createElement(
                    "button",
                    {
                        key: "close",
                        className: "hot-toast__close",
                        type: "button",
                        "aria-label": "Close",
                        onClick: () => props.onClose(toast.id),
                    },
                    React.createElement(
                        "svg",
                        {
                            className: "hot-toast__close-icon",
                            width: 12,
                            height: 12,
                            viewBox: "0 0 12 12",
                            "aria-hidden": true,
                        },
                        React.createElement("path", {
                            d: "M3 3l6 6M9 3L3 9",
                            stroke: "currentColor",
                            strokeWidth: 1.6,
                            strokeLinecap: "round",
                        })
                    )
                ),
            ]
        );
    });

    return React.createElement("div", { className: containerClass }, children);
};

interface ToastControllerProps {
    triggerKey?: string;
    message: string;
    variant: ToastVariant;
    durationMs: number;
    position: ToastPosition;
    maxToasts: number;
    size: ToastSize;
    iconPosition: IconPosition;
    styleVars: React.CSSProperties;
    icons: Record<ToastVariant, string>;
}

interface ToastControllerState {
    toasts: ToastItem[];
}

class ToastController extends React.Component<ToastControllerProps, ToastControllerState> {
    private nextId = 1;

    constructor(props: ToastControllerProps) {
        super(props);
        this.state = { toasts: [] };
    }

    public componentDidMount(): void {
        this.trimToMax(this.props.maxToasts);
    }

    public componentDidUpdate(prevProps: ToastControllerProps): void {
        if (this.props.maxToasts !== prevProps.maxToasts) {
            this.trimToMax(this.props.maxToasts);
        }

        if (this.props.triggerKey !== prevProps.triggerKey) {
            if (this.props.triggerKey !== undefined) {
                this.enqueueToast(this.props.message, this.props.variant, this.props.durationMs);
            }
        }
    }

    public componentWillUnmount(): void {
        this.state.toasts.forEach((toast) => this.clearToastTimers(toast));
    }

    public render(): React.ReactElement {
        const isBottom = this.props.position.startsWith("bottom");
        return React.createElement(ToastHost, {
            toasts: this.state.toasts,
            position: this.props.position,
            isBottom,
            size: this.props.size,
            iconPosition: this.props.iconPosition,
            styleVars: this.props.styleVars,
            icons: this.props.icons,
            onClose: (id) => this.beginRemoveToast(id),
            onPause: (id) => this.pauseToast(id),
            onResume: (id) => this.resumeToast(id),
        });
    }

    private enqueueToast(message: string, variant: ToastVariant, durationMs: number): void {
        const toast: ToastItem = {
            id: this.nextId++,
            message,
            variant,
            durationMs,
            remainingMs: durationMs,
            isExiting: false,
            isPaused: false,
        };

        this.setState(
            (prevState) => ({
                toasts: this.trimList([toast, ...prevState.toasts], this.props.maxToasts),
            }),
            () => this.scheduleAutoClose(toast.id)
        );
    }

    private scheduleAutoClose(id: number): void {
        const toast = this.state.toasts.find((item) => item.id === id);
        if (!toast || toast.durationMs <= 0 || toast.isExiting) {
            return;
        }

        const delayMs = toast.remainingMs > 0 ? toast.remainingMs : toast.durationMs;
        const timerStartedAt = Date.now();
        const timeoutId = window.setTimeout(() => {
            this.beginRemoveToast(id);
        }, delayMs);

        this.updateToast(id, (current) => ({
            ...current,
            remainingMs: delayMs,
            timerStartedAt,
            timeoutId,
        }));
    }

    private pauseToast(id: number): void {
        this.updateToast(id, (toast) => {
            if (toast.durationMs <= 0 || toast.isExiting || toast.timeoutId === undefined) {
                return toast;
            }

            window.clearTimeout(toast.timeoutId);
            const elapsed = toast.timerStartedAt ? Date.now() - toast.timerStartedAt : 0;
            return {
                ...toast,
                remainingMs: Math.max(0, toast.remainingMs - elapsed),
                timeoutId: undefined,
                timerStartedAt: undefined,
                isPaused: true,
            };
        });
    }

    private resumeToast(id: number): void {
        let remainingMs = 0;
        let shouldSchedule = false;

        this.updateToast(
            id,
            (toast) => {
                if (toast.durationMs <= 0 || toast.isExiting || toast.timeoutId !== undefined) {
                    return toast;
                }

                remainingMs = toast.remainingMs;
                shouldSchedule = remainingMs > 0;
                return {
                    ...toast,
                    isPaused: false,
                };
            },
            () => {
                if (remainingMs <= 0) {
                    this.beginRemoveToast(id);
                    return;
                }

                if (shouldSchedule) {
                    this.scheduleAutoClose(id);
                }
            }
        );
    }

    private beginRemoveToast(id: number): void {
        this.updateToast(
            id,
            (toast) => {
                if (toast.isExiting) {
                    return toast;
                }

                if (toast.timeoutId !== undefined) {
                    window.clearTimeout(toast.timeoutId);
                }
                if (toast.exitTimeoutId !== undefined) {
                    window.clearTimeout(toast.exitTimeoutId);
                }

                return {
                    ...toast,
                    isExiting: true,
                    isPaused: false,
                    timeoutId: undefined,
                    timerStartedAt: undefined,
                    exitTimeoutId: undefined,
                };
            },
            () => {
                const exitTimeoutId = window.setTimeout(() => {
                    this.removeToastImmediate(id);
                }, 180);

                this.updateToast(id, (toast) => ({
                    ...toast,
                    exitTimeoutId,
                }));
            }
        );
    }

    private removeToastImmediate(id: number): void {
        this.setState((prevState) => {
            const toast = prevState.toasts.find((item) => item.id === id);
            if (!toast) {
                return null;
            }

            this.clearToastTimers(toast);
            return { toasts: prevState.toasts.filter((item) => item.id !== id) };
        });
    }

    private clearToastTimers(toast: ToastItem): void {
        if (toast.timeoutId !== undefined) {
            window.clearTimeout(toast.timeoutId);
        }
        if (toast.exitTimeoutId !== undefined) {
            window.clearTimeout(toast.exitTimeoutId);
        }
    }

    private trimToMax(maxToasts: number): void {
        this.setState((prevState) => {
            const trimmed = this.trimList(prevState.toasts, maxToasts);
            if (trimmed.length === prevState.toasts.length) {
                return null;
            }
            return { toasts: trimmed };
        });
    }

    private trimList(list: ToastItem[], maxToasts: number): ToastItem[] {
        const safeMax = maxToasts < 1 ? 1 : maxToasts;
        if (list.length <= safeMax) {
            return list;
        }

        const trimmed = list.slice(0, safeMax);
        const removed = list.slice(safeMax);
        removed.forEach((toast) => this.clearToastTimers(toast));
        return trimmed;
    }

    private updateToast(
        id: number,
        updater: (toast: ToastItem) => ToastItem,
        callback?: () => void
    ): void {
        let didUpdate = false;
        this.setState(
            (prevState) => {
                let changed = false;
                const updated = prevState.toasts.map((toast) => {
                    if (toast.id !== id) {
                        return toast;
                    }
                    changed = true;
                    return updater(toast);
                });

                if (!changed) {
                    return null;
                }
                didUpdate = true;
                return { toasts: updated };
            },
            () => {
                if (callback && didUpdate) {
                    callback();
                }
            }
        );
    }
}

export class HotToast implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    constructor() {
        // Empty
    }

    public init(
        _context: ComponentFramework.Context<IInputs>,
        _notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary
    ): void {
        // Empty
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const triggerKey = this.getString(context.parameters.triggerKey);
        const message = this.getString(context.parameters.message) ?? "";
        const variant = this.normalizeVariant(this.getString(context.parameters.variant));
        const durationMs = this.normalizeDuration(this.getNumber(context.parameters.durationMs));
        const position = this.normalizePosition(this.getString(context.parameters.position));
        const size = this.normalizeSize(this.getString(context.parameters.size));
        const iconPosition = this.normalizeIconPosition(this.getString(context.parameters.iconPosition));
        const bgColor = this.normalizeColor(this.getString(context.parameters.bgColor));
        const textColor = this.normalizeColor(this.getString(context.parameters.textColor));
        const accentColor = this.normalizeColor(this.getString(context.parameters.accentColor));
        const radiusPx = this.normalizePx(this.getNumber(context.parameters.radiusPx));
        const minWidthPx = this.normalizePx(this.getNumber(context.parameters.minWidthPx));
        const maxWidthPx = this.normalizePx(this.getNumber(context.parameters.maxWidthPx));
        const iconSet = this.normalizeIconSet(this.getString(context.parameters.iconSet));
        const icons = this.normalizeIcons(iconSet);
        const maxToasts = this.normalizeMaxToasts(this.getNumber(context.parameters.maxToasts));

        const styleVars = this.buildStyleVars({
            bgColor,
            textColor,
            accentColor,
            radiusPx,
            minWidthPx,
            maxWidthPx,
        });

        return React.createElement(ToastController, {
            triggerKey,
            message,
            variant,
            durationMs,
            position,
            maxToasts,
            size,
            iconPosition,
            styleVars,
            icons,
        });
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // Empty
    }

    private getString(property?: RawValueProperty): string | undefined {
        const raw: unknown = property?.raw;
        if (raw === undefined || raw === null) {
            return undefined;
        }
        if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
            return String(raw);
        }
        return undefined;
    }

    private getNumber(property?: RawValueProperty): number | undefined {
        const rawValue: unknown = property?.raw;
        if (rawValue === undefined || rawValue === null) {
            return undefined;
        }
        if (typeof rawValue === "string" && rawValue.trim() === "") {
            return undefined;
        }
        if (typeof rawValue === "number" && Number.isNaN(rawValue)) {
            return undefined;
        }
        return Number(rawValue);
    }

    private normalizeVariant(value?: string): ToastVariant {
        if (value === "danger") {
            return "error";
        }
        if (value === "success" || value === "warning" || value === "error" || value === "info") {
            return value;
        }
        return "info";
    }

    private normalizePosition(value?: string): ToastPosition {
        if (
            value === "top-right" ||
            value === "top-left" ||
            value === "bottom-right" ||
            value === "bottom-left"
        ) {
            return value;
        }
        return "top-right";
    }

    private normalizeDuration(value?: number): number {
        if (value === undefined) {
            return 3000;
        }
        const normalized = Math.round(value);
        return normalized <= 0 ? 3000 : normalized;
    }

    private normalizeMaxToasts(value?: number): number {
        if (value === undefined) {
            return 3;
        }
        const normalized = Math.round(value);
        return normalized < 1 ? 1 : normalized;
    }

    private normalizeSize(value?: string): ToastSize {
        if (value === "sm" || value === "md" || value === "lg") {
            return value;
        }
        return "md";
    }

    private normalizeIconPosition(value?: string): IconPosition {
        if (value === "left" || value === "right") {
            return value;
        }
        return "left";
    }

    private normalizeColor(value?: string): string | undefined {
        if (!value) {
            return undefined;
        }
        return value.trim();
    }

    private normalizePx(value?: number): number | undefined {
        if (value === undefined) {
            return undefined;
        }
        const normalized = Math.round(value);
        return normalized > 0 ? normalized : undefined;
    }

    private normalizeIconSet(value?: string): IconSet {
        if (value === "emoji" || value === "minimal" || value === "bold") {
            return value;
        }
        return "emoji";
    }

    private normalizeIcons(iconSet: IconSet): Record<ToastVariant, string> {
        const defaults = ICON_SETS[iconSet] ?? ICON_SETS.emoji;
        return {
            info: defaults.info,
            success: defaults.success,
            warning: defaults.warning,
            error: defaults.error,
        };
    }

    private buildStyleVars(values: {
        bgColor?: string;
        textColor?: string;
        accentColor?: string;
        radiusPx?: number;
        minWidthPx?: number;
        maxWidthPx?: number;
    }): React.CSSProperties {
        const styleVars: Record<string, string> = {};
        if (values.bgColor) {
            styleVars["--hot-toast-bg"] = values.bgColor;
        }
        if (values.textColor) {
            styleVars["--hot-toast-text"] = values.textColor;
        }
        if (values.accentColor) {
            styleVars["--hot-toast-accent"] = values.accentColor;
            styleVars["--hot-toast-icon-fg"] = values.accentColor;
        }
        if (values.radiusPx) {
            styleVars["--hot-toast-radius"] = `${values.radiusPx}px`;
        }
        if (values.minWidthPx) {
            styleVars["--hot-toast-min-width"] = `${values.minWidthPx}px`;
        }
        if (values.maxWidthPx) {
            styleVars["--hot-toast-max-width"] = `${values.maxWidthPx}px`;
        }
        return styleVars;
    }
}
