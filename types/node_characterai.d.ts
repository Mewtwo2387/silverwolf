declare module 'node_characterai' {
  interface ChatResponse {
    text: string;
    srcChar: {
      participant: { name: string };
      character: { avatar_file_name: string };
    };
  }

  interface Chat {
    sendAndAwaitResponse(message: string, withChatHistory?: boolean): Promise<ChatResponse>;
    saveAndStartNewChat(): Promise<void>;
  }

  class CharacterAI {
    authenticateAsGuest(): Promise<void>;
    authenticateWithToken(token: string): Promise<void>;
    createOrContinueChat(characterId: string): Promise<Chat>;
  }

  export default CharacterAI;
}
