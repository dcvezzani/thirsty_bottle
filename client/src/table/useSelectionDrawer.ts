import { useEffect } from 'react';
import { useUI } from './ui';

/**
 * stable-selection-bar: the selection toolbar takes the place of the panel tabs, which are what close the chat
 * drawer, so starting a selection closes an open drawer (it would otherwise be stuck open).
 */
export function useSelectionDrawer(selecting: boolean) {
  useEffect(() => {
    if (selecting && useUI.getState().drawer) useUI.setState({ drawer: null });
  }, [selecting]);
}
