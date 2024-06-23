import { chat, chat_metadata, saveChatDebounced, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, saveMetadataDebounced } from '../../../extensions.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { delay } from '../../../utils.js';

class Settings {
    /**@type {boolean} */ updateChatVars = true;

    save() {
        saveSettingsDebounced();
    }
}
/**@type {Settings} */
const settings = Object.assign(new Settings(), extension_settings.messageVariables ?? {});
extension_settings.messageVariables = settings;

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'setmesvar',
    callback: (args, value)=>{
        const name = /**@type{string}*/(args.key) ?? null;
        if (name == null) {
            throw new Error('/setmesvar requires key');
        }
        const mesId = /**@type {number}*/(args.mes ?? chat.findLastIndex(it=>!it.is_system));
        setMessageVar(mesId, args.key, value, args.index);
        return value;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'key',
            description: 'variable name',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'index',
            description: 'list index',
            typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'mes',
            description: 'message id, negative numbers start at {{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: 'last not-hidden message',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'value',
            typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
            isRequired: true,
        }),
    ],
    helpString: 'Set a message bound variable.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'getmesvar',
    callback: (args, value)=>{
        const name = /**@type{string}*/(args.key ?? value) ?? null;
        if (name == null) {
            throw new Error('/setmesvar requires key');
        }
        const mesId = /**@type {number}*/(args.mes ?? chat.findLastIndex(it=>!it.is_system));
        const vars = getMessageVars(mesId);
        let variable = vars?.[name];
        if (args.index !== undefined) {
            try {
                variable = JSON.parse(variable);
                const numIndex = Number(args.index);
                if (Number.isNaN(numIndex)) {
                    variable = variable[args.index];
                } else {
                    variable = variable[Number(args.index)];
                }
                if (typeof variable == 'object') {
                    variable = JSON.stringify(variable);
                }
            } catch {
            // that didn't work
            }
        }

        return (variable === '' || isNaN(Number(variable))) ? (variable || '') : Number(variable);
    },
    returns: 'message bound variable value',
    namedArgumentList: [
        new SlashCommandNamedArgument(
            'key', 'variable name', [ARGUMENT_TYPE.VARIABLE_NAME], false,
        ),
        new SlashCommandNamedArgument(
            'index', 'list index', [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING], false,
        ),
        SlashCommandNamedArgument.fromProps({ name: 'mes',
            description: 'message id, negative numbers start at {{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: 'last not-hidden message',
        }),
    ],
    unnamedArgumentList: [
        new SlashCommandArgument(
            'variable name', [ARGUMENT_TYPE.VARIABLE_NAME], false,
        ),
    ],
    helpString: 'Get a message bound variable value and pass it down the pipe.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'getmesvars',
    callback: (args, value)=>{
        const mesId = /**@type {number}*/(args.mes ?? (value == '' ? chat.findLastIndex(it=>!it.is_system) : value));
        const vars = getMessageVars(mesId);
        return JSON.stringify(vars ?? {});
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'mes',
            description: 'message id, negative numbers start at {{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: 'last not-hidden message',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'message id, negative numbers start at {{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: 'last not-hidden message',
        }),
    ],
    helpString: 'Get a dictionary with all the message bound variables.',
}));




const getMessageVars = (mesId)=>{
    const mes = chat.slice(mesId)[0];
    if (!mes) {
        throw new Error(`message ${mesId} does not exist`);
    }
    const swipeId = mes.swipe_id ?? 0;
    return (mes.variables ?? [])[swipeId];
};
const setMessageVar = (mesId, key, val, index = null)=>{
    const mes = chat.slice(mesId)[0];
    if (!mes) {
        throw new Error(`message ${mesId} does not exist`);
    }
    const swipeId = mes.swipe_id ?? 0;
    if (!mes.variables) {
        mes.variables = [];
    }
    if (!mes.variables[swipeId]) {
        mes.variables[swipeId] = {};
    }
    if (index) {
        let variable = JSON.parse(mes.variables[swipeId][key] ?? 'null');
        const numIndex = Number(index);
        if (Number.isNaN(numIndex)) {
            if (variable === null) {
                variable = {};
            }
            variable[index] = val;
        } else {
            if (variable === null) {
                variable = [];
            }
            variable[numIndex] = val;
        }
        mes.variables[swipeId][key] = JSON.stringify(variable);
    } else {
        mes.variables[swipeId][key] = val;
    }
    if (settings.updateChatVars && mes == chat.findLast(it=>!it.is_system)) {
        if (!chat_metadata.variables) chat_metadata.variables = {};
        chat_metadata.variables[key] = mes.variables[swipeId][key];
        saveMetadataDebounced();
        saveChatDebounced();
    }
};




const updateChatVars = async()=>{
    let prev;
    while (true) {
        await delay(500);
        if (!settings.updateChatVars) continue;
        const mes = chat.filter(it=>!it.is_system).slice(-1)[0];
        if (!mes) continue;
        if (!mes.variables) continue;

        const swipeId = mes.swipe_id ?? 0;

        const cur = JSON.stringify(mes.variables[swipeId]);
        if (prev != cur) {
            prev = cur;
            Object.assign(chat_metadata.variables, mes.variables[swipeId]);
            saveMetadataDebounced();
        }
    }
};
updateChatVars();
