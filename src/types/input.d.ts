declare module 'input' {
  interface InputOptions {
    hidden?: boolean;
    replace?: string;
    default?: string;
    edit?: boolean;
  }

  interface Input {
    text(prompt: string, options?: InputOptions): Promise<string>;
    password(prompt: string, options?: InputOptions): Promise<string>;
    confirm(prompt: string, options?: InputOptions): Promise<boolean>;
    select(prompt: string, choices: string[], options?: InputOptions): Promise<string>;
  }

  const input: Input;
  export = input;
}