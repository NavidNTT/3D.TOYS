'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearToyModelCache, type DracoDecoderPath } from './ToyModel';

/** One Draco-free retry per model/decoder combination. */
const MAX_RETRIES = 1;

interface ModelLoadBoundaryProps {
  modelUrl: string;
  /** Changing this (e.g. `/draco/` â†’ `false`) restarts the boundary. */
  dracoDecoderPath: DracoDecoderPath;
  /** Asks the viewer to re-render the model without a Draco decoder. */
  onRecover: () => void;
  /** Called when the Draco-free attempt failed as well. */
  onFail: (error: Error) => void;
  /** Rendered inside the canvas when nothing can be displayed. */
  fallback?: ReactNode;
  children: ReactNode;
}

interface ModelLoadBoundaryState {
  failed: boolean;
  /**
   * Retries already used. Kept in state (not on the instance) so the retry
   * budget travels with the render pass that consumed it: a stale-props
   * re-render in the canvas' own React root cannot re-trigger the fallback.
   */
  attempts: number;
  /** Snapshot of the inputs the current attempt belongs to. */
  modelUrl: string;
  dracoKey: string;
}

/**
 * Keeps a broken 3D model from taking down the whole viewer.
 *
 * A loader failure surfaces as a render error inside the canvas (Suspense
 * re-throws the rejection), and React only hands those to an error boundary.
 * The first failure clears the cached rejection and asks the viewer for a
 * retry without Draco â€” enough to save the viewer when the decoder assets are
 * unreachable but the model is a plain `.glb`. A second failure keeps the
 * graceful panel instead of looping.
 */
export default class ModelLoadBoundary extends Component<
  ModelLoadBoundaryProps,
  ModelLoadBoundaryState
> {
  state: ModelLoadBoundaryState = {
    failed: false,
    attempts: 0,
    modelUrl: this.props.modelUrl,
    dracoKey: String(this.props.dracoDecoderPath),
  };

  /**
   * A new model â€” or the viewer switching the decoder off for the retry â€”
   * resets the failure state, including the retry budget. This is what makes
   * the recovery order-independent: whichever root renders first, the retry
   * still gets its chance.
   */
  static getDerivedStateFromProps(
    props: ModelLoadBoundaryProps,
    state: ModelLoadBoundaryState,
  ): Partial<ModelLoadBoundaryState> | null {
    const dracoKey = String(props.dracoDecoderPath);

    if (state.modelUrl === props.modelUrl && state.dracoKey === dracoKey) {
      return null;
    }

    return { failed: false, attempts: 0, modelUrl: props.modelUrl, dracoKey };
  }

  static getDerivedStateFromError(): Partial<ModelLoadBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.state.attempts >= MAX_RETRIES) {
      console.error(
        `[ProductViewer3D] could not load ${this.props.modelUrl} (even without Draco)`,
        error,
        info.componentStack,
      );
      this.props.onFail(error);

      return;
    }

    console.warn(
      `[ProductViewer3D] loading ${this.props.modelUrl} failed â€” retrying without Draco`,
      error,
    );

    // Drop the rejected promise r3f cached for this URL (it keys assets by
    // [loader, url], so the retry would otherwise re-throw it immediately),
    // then hand control back to the viewer.
    clearToyModelCache(this.props.modelUrl);
    this.setState((state) => ({ failed: false, attempts: state.attempts + 1 }));
    this.props.onRecover();
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}

