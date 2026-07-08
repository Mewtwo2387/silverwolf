import { CommandGroup } from '../classes/commandGroup';

export default class Ai extends CommandGroup {
  constructor(client: any) {
    super(client, 'ai', 'Manage your AI chat sessions', [
      'view', 'chatnew', 'chatswitch', 'chatdelete', 'retitle', 'usage',
      'rp-create-char', 'rp-details', 'rp-edit', 'rp-spawn', 'rp-remove', 'rp-setasset',
      'rp-lorebook-add', 'rp-lorebook-remove', 'rp-lorebook-view',
      'rp-persona-add', 'rp-persona-remove',
    ]);
  }
}
