
//adding and removing error messages to the form
function clear_errors() {
  $("#error_list").empty();
  $("#error_container").hide();
}

function display_error(msg) {
  $("#error_list").append($("<li>" + msg + "</li>"));
  $("#error_container").show();
}


//hides all extra scheduler options in forms
function hide_extra_options() { 
    $(".extra_option").hide();
}

//add a time slice to our result list
function add_time_slice(t, name) {
    $('#time_slice_container').show();
    var time_slice = $('<li class="time_slice table_row"></li>');
    time_slice.append('<div class="time_slice_t">' + t + '</div>');
    time_slice.append('<div class="time_slice_process_name">' + name + '</div>');
    $('#time_slice_list').append(time_slice);

}

//clear all time slices from our result list
function clear_time_slices() {
    $('.time_slice:not(.header)').detach();
    $('#time_slice_container').hide();
}

//add a new process input to the form
function add_process_input() {
    var n = $(".process_input").length + 1;
    var process_input = $('<li class="process_input table_row"></li>');
    process_input.append('<div class="process_input_number">P'+n+'.</div>');
    process_input.append('<div class="process_input_arrival">arrival time: <input type="number" min="0" max="9999"></div>');
    process_input.append('<div class="process_input_burst">burst time:     <input type="number" min="1" max="9999"></div>');
    $("#process_input_list").append(process_input);
}

function delete_process_input() {
    $(".process_input:last").detach();
}

//constructs a new process control block
function new_process_block(name, arrival_time, burst, dom_element) {
    var proc = new Object();
    proc.name = name;
    proc.arrival = arrival_time;
    proc.burst = burst;
    proc.dom_element = dom_element;
    proc.time_completed = 0;
    return proc;
}

//read form data from process inputs and construct a list of process control blocks
function read_process_inputs() {
    return $("#process_input_list > .process_input").map(
        function (i) {
            var arrival = $(this).find(".process_input_arrival > input").val();
            var burst = $(this).find(".process_input_burst > input").val();
            var valid = true;
            if (arrival === null || arrival < 0) {
                display_error("Invalid arrival time for process " + (i+1));
                valid = false;
            }
            if (burst === null || burst < 1) {
                display_error("Invalid burst time for process " + (i+1));
                valid = false;
            }
            return valid? new_process_block("P" + (i+1), arrival, burst, this) : null;
        }
    );
}





//Internal plumbing common to all scheduling algorithms.
//Simulates newly arriving processes in the ready queue
function iterate_scheduler(proc_list, callback) {
    proc_list = jQuery.makeArray(proc_list);
    ready_queue = new Array();
    var running_process;
    for(var t = 0; proc_list.length || running_process; t++) {
        //add newly arriving processes to ready queue
        for (var i = 0; i < proc_list.length; i++) {
            var proc = proc_list[i];
            if (proc.arrival == t) {
                ready_queue.push(proc);
                proc_list.splice(i, 1);
                i--;
            }
        }
        if (running_process = callback(ready_queue, t)) {
            running_process.time_completed++;
            add_time_slice(t, running_process.name);
        }
        else {
            add_time_slice(t, "(No allocated process)");
        }
    }
}

//RR scheduler
function run_round_robin(proc_list, is_preemptive, time_quantum) {
    var running_process;
    var time_in_slice = 0;
    iterate_scheduler(proc_list, function (ready_queue, t) { 
        if (running_process) {
            //if process has terminated
            if (running_process.time_completed >= running_process.burst) {
                time_in_slice = 0;
                running_process = ready_queue.shift();
            }
            //if process has used its time quantum
            else if (is_preemptive && time_in_slice >= time_quantum) {
                ready_queue.push(running_process);
                time_in_slice = 0;
                running_process = ready_queue.shift();
            }
        }
        else {
            running_process = ready_queue.shift();
        }
        if (running_process) {
            time_in_slice++;
        }
        return running_process;
    });  
}

//FCFS is just RR without using preemption
function run_fcfs(proc_list, is_preeptive) {
    run_round_robin(proc_list, false, null);
}

function run_sjf(proc_list, is_preemptive) {
    var running_process;
    iterate_scheduler(proc_list, function (ready_queue, t) { 
        if (running_process) {
            //if process has terminated
            if (running_process.time_completed >= running_process.burst) {
                running_process = pop_shortest_time(ready_queue);
            }
            else if (is_preemptive) {
                //pop the shortest time in ready queue if it's shorter than current process
                var min_index = find_shortest_time(ready_queue);
                if (min_index != -1 
                 && time_remaining(running_process) > time_remaining(ready_queue[min_index])) {
                    ready_queue.push(running_process);
                    running_process = ready_queue.splice(min_index, 1)[0];
                }
            }
        }
        else {
            running_process = pop_shortest_time(ready_queue);
        }
        return running_process;
    });
}

//return the index of the element of a PCB list whose completion time is shortest
function find_shortest_time(proc_list) {
    var min_index = -1;
    for(var i = 0; i < proc_list.length; i++) {
        if (min_index == -1 || time_remaining(proc_list[min_index]) > time_remaining(proc_list[i])) {
            min_index = i;
        }
    }
    return min_index;
}

//remove and return the element of a PCB list whose completion time is shortest
function pop_shortest_time(proc_list) {
    var min_index = find_shortest_time(proc_list);
    if (min_index == -1) { return null; }
    else                 { return proc_list.splice(min_index, 1)[0]; }
}

//calculates the time remaining to complete the process' CPU burst
function time_remaining(proc) {
    return proc.burst - proc.time_completed;
}

//add event handlers to DOM elements once the document has loaded
$(document).ready(function () {
    //on-click event handlers for scheduler options
    $("#round_robin_option").click(function () {
        hide_extra_options();
        $('#time_quantum').show();
    });
    $("#sjf_option").click(hide_extra_options);
    $("#fcfs_option").click(hide_extra_options);
    
    //on-click events to add new/delete process input form
    $("#add_process_input").click(add_process_input);
    $("#delete_process_input").click(delete_process_input);
    //on submit of the input form, begin the selected scheduling algorithm
    $("#run_button").click(function () {
        clear_errors();
    
        var proc_list = read_process_inputs();
        var is_preemptive = $("#preemptive_checkbox").is(":checked");
    
        if ($("#round_robin_option").is(":checked")) {
            clear_time_slices();
            var time_quantum = $("#time_quantum input").val();
            if (time_quantum > 0) {
                run_round_robin(proc_list, is_preemptive, $("#time_quantum input").val());
            }
            else {
                display_error("Invalid time quantum.");
            }
        }
        else if ($("#sjf_option").is(":checked")) {
            clear_time_slices();
            run_sjf(proc_list, is_preemptive);
        }
        else if ($("#fcfs_option").is(":checked")) {
            clear_time_slices();
            run_fcfs(proc_list, is_preemptive);
        }
        else {
            display_error("No scheduler algorithm specified.");
        }
    });
    
});