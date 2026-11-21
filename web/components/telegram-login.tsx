"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

type Props = {
  botUsername: string;
  lang: string;
  onAuth: (user: Record<string, unknown>) => void;
};

/**
 * Embeds the official Telegram Login Widget. The widget only works on the HTTPS domain registered with
 * @BotFather (/setdomain); the signed payload is verified on the server, never trusted here.
 */
export function TelegramLogin({ botUsername, lang, onAuth }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const handler = useRef(onAuth);
  useEffect(() => {
    handler.current = onAuth;
  });

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    window.__onTelegramAuth = (user) => handler.current(user);
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = "large";
    script.dataset.radius = "27";
    script.dataset.lang = lang;
    script.dataset.userpic = "false";
    script.dataset.onauth = "__onTelegramAuth(user)";
    node.replaceChildren(script);
    return () => {
      node.replaceChildren();
      delete window.__onTelegramAuth;
    };
  }, [botUsername, lang]);

  return <div ref={box} />;
}
