import { Scenes } from "telegraf";

export interface BotSession extends Scenes.WizardSessionData {
  orderId?: string;
  orderType?: string;
  [key: string]: any;
}

export interface BotContext extends Scenes.WizardContext<BotSession> {}
