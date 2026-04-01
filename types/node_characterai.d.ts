declare module 'node_characterai' {
  class CharacterAI {
    authenticateAsGuest(): Promise<void>;
    authenticateWithToken(token: string): Promise<void>;
    createOrContinueChat(characterId: string): Promise<Chat>;
  }

  interface Chat {
    sendAndAwaitResponse(message: string, withChatHistory?: boolean): Promise<ChatResponse>;
    saveAndStartNewChat(): Promise<void>;
  }

  interface ChatResponse {
    text: string;
    srcChar: {
      participant: { name: string };
      character: { avatar_file_name: string };
    };
  }

  export default CharacterAI;
}
