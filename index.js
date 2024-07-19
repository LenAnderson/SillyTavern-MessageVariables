import { chat, chat_metadata, saveChatDebounced, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, saveMetadataDebounced } from '../../../extensions.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from '../../../slash-commands/SlashCommandClosure.js';
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
    callback: async(args, value)=>{
        const name = /**@type{string}*/(args.key) ?? null;
        if (name == null) {
            throw new Error('/setmesvar requires key');
        }
        const mesId = /**@type {number}*/(args.mes ?? chat.findLastIndex(it=>!it.is_system));
        await setMessageVar(mesId, args.filter, args.key, value, args.index);
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
        SlashCommandNamedArgument.fromProps({ name: 'filter',
            description: 'closure to filter the chat history with, must return true or false',
            typeList: [ARGUMENT_TYPE.CLOSURE],
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
    callback: async(args, value)=>{
        const name = /**@type{string}*/(args.key ?? value) ?? null;
        if (name == null) {
            throw new Error('/setmesvar requires key');
        }
        const mesId = /**@type {number}*/(args.mes ?? chat.findLastIndex(it=>!it.is_system));
        const vars = await getMessageVars(mesId, args.filter);
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
        SlashCommandNamedArgument.fromProps({ name: 'filter',
            description: 'closure to filter the chat history with, must return true or false',
            typeList: [ARGUMENT_TYPE.CLOSURE],
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
    callback: async(args, value)=>{
        const mesId = /**@type {number}*/(args.mes ?? (value == '' ? chat.findLastIndex(it=>!it.is_system) : value));
        const vars = await getMessageVars(mesId, args.filter);
        return JSON.stringify(vars ?? {});
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'mes',
            description: 'message id, negative numbers start at {{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: 'last not-hidden message',
        }),
        SlashCommandNamedArgument.fromProps({ name: 'filter',
            description: 'closure to filter the chat history with, must return true or false',
            typeList: [ARGUMENT_TYPE.CLOSURE],
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

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'flushmesvar',
    callback: async(args, value)=>{
        const name = /**@type{string}*/(args.key ?? value) ?? null;
        if (name == null) {
            throw new Error('/setmesvar requires key');
        }
        const mesId = /**@type {number}*/(args.mes ?? chat.findLastIndex(it=>!it.is_system));
        await flushMessageVar(mesId, args.filter, name);
        return '';
    },
    returns: 'message bound variable value',
    namedArgumentList: [
        new SlashCommandNamedArgument(
            'key', 'variable name', [ARGUMENT_TYPE.VARIABLE_NAME], false,
        ),
        SlashCommandNamedArgument.fromProps({ name: 'mes',
            description: 'message id, negative numbers start at {{lastMessageId}}',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: 'last not-hidden message',
        }),
        SlashCommandNamedArgument.fromProps({ name: 'filter',
            description: 'closure to filter the chat history with, must return true or false',
            typeList: [ARGUMENT_TYPE.CLOSURE],
        }),
    ],
    unnamedArgumentList: [
        new SlashCommandArgument(
            'variable name', [ARGUMENT_TYPE.VARIABLE_NAME], false,
        ),
    ],
    helpString: `
            <div>
                Delete a message variable.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/flushmesvar score</code></pre>
                    </li>
                </ul>
            </div>
        `,
}))




/**
 * @param {number} mesId
 * @param {SlashCommandClosure} filter
 */
const getMessage = async(mesId, filter)=>{
    const mesList = [];
    if (filter) {
        const ogScope = filter.scope.getCopy();
        for (const mes of chat) {
            filter.scope = ogScope.getCopy();
            for (const key of Object.keys(mes)) {
                filter.scope.setMacro(key, mes[key]);
            }
            if ((await filter.execute()).pipe) {
                mesList.push(mes);
            }
        }
    } else {
        mesList.push(...chat);
    }
    return mesList.slice(mesId)[0];
};
const getMessageVars = async(mesId, filter)=>{
    const mes = await getMessage(mesId, filter);
    if (!mes) {
        throw new Error(`message ${mesId} does not exist`);
    }
    const swipeId = mes.swipe_id ?? 0;
    return (mes.variables ?? [])[swipeId];
};
const setMessageVar = async(mesId, filter, key, val, index = null)=>{
    const mes = await getMessage(mesId, filter);
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
    }
    saveChatDebounced();
};
const flushMessageVar = async(mesId, filter, key)=>{
    const mes = await getMessage(mesId, filter);
    if (!mes) {
        throw new Error(`message ${mesId} does not exist`);
    }
    const swipeId = mes.swipe_id ?? 0;
    if (!mes.variables) {
        return;
    }
    if (!mes.variables[swipeId]) {
        return;
    }
    delete mes.variables[swipeId][key];
    if (settings.updateChatVars && mes == chat.findLast(it=>!it.is_system)) {
        if (!chat_metadata.variables) chat_metadata.variables = {};
        chat_metadata.variables[key] = mes.variables[swipeId][key];
        saveMetadataDebounced();
    }
    saveChatDebounced();
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
