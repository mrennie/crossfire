#!/usr/bin/env python
#
# crossfire_test_client.py
# Crossfire protocol test client implementation in python.
#
# M. G. Collins
#
# Copyright (c) 2009. All rights reserved.
#
# See license.txt for terms of usage.
#
# Usage:
# $> python crossfire_test_client.py [<host>] <port> [--command=<command>[--args=<args>]]
#
# On Windows platforms, try installing the pyreadline package.
#

import json, readline, socket, sys, threading, time

from optparse import OptionParser

parser = OptionParser()

 # server host, defaults to localhost
parser.add_option("-s", "--host",
                    action="store", type="string", dest="serverHost", default="localhost",
                    help="host name for the crossfire server, defaults to localhost")

# server port, required
parser.add_option("-p", "--port" ,
                    action="store", type="int", dest="serverPort",
                    help="port number the crossfire server is running on")

# interactive command-line
parser.add_option("-i", "--interactive",
                    action="store_true", dest="interactive",
                    help="starts the interactive command-line after connecting")

# remote command to execute after handshake
parser.add_option("-c", "--command",
                    action="store", type="string", dest="execCommand",
                    help="sends a command to the crossfire server after connecting")

# optional arguments to command specified by -c
parser.add_option("-a", "--args",
                    action="store", type="string", dest="execArgs",
                    help="optional arguments for the command specified by -c")

# optional tool header to command specified by -c
parser.add_option("-t", "--tool",
                    action="store", type="string", dest="execTool", default="debugger",
                    help="optional tool header for the command specified by -c")


HANDSHAKE_STRING = "CrossfireHandshake"
TOOL_STRING = "console,net,inspector,dom"
#TOOL_STRING = "net,debugger"

###############################################################################

current_seq = 0

class CrossfireClient:

  def __init__(self, host, port):
    self.host = host
    self.port = port

  def start(self):
    #self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    #try:
    #  self.socket.bind((self.host, self.port))
    #except socket.error:
    #  print socket.error
    #  quit()

    #self.socket.listen(1)
    #self.conn, addr = self.socket.accept()

    #self.conn = self.socket.connect((self.host, self.port))

    self.socket = socket.create_connection((self.host, self.port))

    self.socketCondition = threading.Condition()
    self.reader = PacketReader(self.socket, self.socketCondition)
    self.writer = PacketWriter(self.socket, self.socketCondition)

    self.socket.settimeout(10)
    self.socket.send(HANDSHAKE_STRING)
    self.socket.send("\r\n")
    self.socket.send(TOOL_STRING)
    self.socket.send("\r\n")

    self.waitHandshake()

  def stop(self):
    try:
      #self.conn.close()
      self.socket.close()
      #self.socketCondition.acquire()
      self.reader.join(0)
      self.writer.join(0)
    except (AttributeError, KeyboardInterrupt):
      pass

  def restart(self):
    self.stop()
    self.start()

  def waitHandshake(self):
    shake = ''
    print 'Waiting for Crossfire handshake...'
    try:
      shake = self.socket.recv(len(HANDSHAKE_STRING))
      print shake
    except socket.error, msg:
      print msg
    if shake == HANDSHAKE_STRING:
      print 'Received Crossfire handshake.'

      prev = curr = ""
      while prev != '\r' and curr != '\n':
        prev = curr
        try:
          curr = self.socket.recv(1)
        except socket.error:
          break

      tools = prev = curr = ""
      while prev != '\r' and curr != '\n':
        prev = curr
        try:
          curr = self.socket.recv(1)
          tools += str(curr)
        except socket.error:
          break

      print "Got tools: " + tools

      self.socketCondition.acquire()
      self.writer.start()
      self.reader.start()
      self.socketCondition.notifyAll()
      self.socketCondition.release()

  def sendPacket(self, packet):
    self.writer.addPacket(packet)

  def getPacket(self):
    if self.reader:
      return self.reader.getPacket()


class PacketReader(threading.Thread):
  def __init__(self, conn, cv):
    threading.Thread.__init__(self)
    self.daemon = True
    self.packetQueue = []
    self.conn = conn
    self.cv = cv

  def getPacket(self):
    if len(self.packetQueue) > 0:
      return self.packetQueue.pop()

  def run(self):
    global current_seq

    while True:
      try:
        self.cv.acquire()
        headers = self.readPacketHeaders()
        if "Content-Length" in headers:
          print "\nheaders => " + str(headers)
          length = int(headers["Content-Length"])
          if length > 0:
            packet = self.readPacket(length)
            if packet:
              obj = json.loads(packet)
              current_seq = obj['seq'] +1
              if "tool" in headers:
                obj['tool'] = headers["tool"]
              self.packetQueue.append(obj)
        self.cv.notifyAll()
        self.cv.wait()
      except Exception as doh:
        print "Doh!"
        print doh
        break

  def readPacketHeaders(self):
    headers = {}
    readHeaders = True
    buff = prev = curr = ""

    while readHeaders:
      while prev != '\r' and curr != '\n':
        prev = curr
        try:
          curr = self.conn.recv(1)
          buff += str(curr)
        except socket.error:
          readHeaders = False
          break
      readHeaders = len(buff) > 2
      if readHeaders:
        ci = buff.find(":")
        name = buff[:ci]
        value = buff[ci+1:len(buff)-2]
        headers[name] = value
        # reset everything before next loop
        prev = curr = name = value = buff = ""
    return headers

  def readPacket(self, length):
    packet = ""
    read = offset = 0

    while read < length:
      if length-read < 4096:
        offset = length-read
      else:
        offset = 4096
      packet += self.conn.recv(offset)
      read += offset
    return packet


class PacketWriter(threading.Thread):
  def __init__(self, conn, cv):
    threading.Thread.__init__(self)
    self.daemon = True
    self.packetQueue = []
    self.conn = conn
    self.cv = cv

  def addPacket(self, packet):
    self.packetQueue.append(packet)

  def run(self):
    while True:
      try:
        self.cv.acquire()
        if len(self.packetQueue) > 0:
          packet = self.packetQueue.pop()
          json_str = json.dumps(packet.packet)
          packet_string = "Content-Length:" + str(len(json_str)) + "\r\n"
          if packet.tool:
            packet_string += "tool:" + str(packet.tool) + "\r\n"
          packet_string  += "\r\n" + json_str
          print "Sending a packet\n" + packet_string
          self.conn.send(packet_string)

        self.cv.notifyAll()
        self.cv.wait()
      except Error:
        #print err
        break


class Command:
  def __init__(self, context_id, command_name, tool_name="debugger", **arguments):
    global current_seq
    current_seq += 1
    self.seq = current_seq
    self.command = command_name
    self.tool = tool_name
    self.packet = { "type": "request", "seq": self.seq, "context_id" : context_id, "command": command_name }
    if arguments:
      self.packet.update(arguments)


Commands = [
    "entercontext",
    "createcontext",
    "listcontexts",
    "version",
    "continue",
    "suspend",
    "evaluate",
    "backtrace",
    "frame",
    "scope",
    "scopes",
    "script",
    "scripts",
    "source",
    "getbreakpoint",
    "getbreakpoints",
    "setbreakpoint",
    "changebreakpoint",
    "clearbreakpoint",
    "inspect",
    "lookup",
    "gettools",
    "enabletools",
    "disabletools"
]

COMMAND_PROMPT = 'Crossfire x> '

class CommandLine(threading.Thread):
  def __init__(self):
    threading.Thread.__init__(self)
    self.daemon = True
    self.commands = []
    self.current_context = ""

  def setContext(self, ctx):
    self.current_context = ctx

  def getCommand(self):
    if len(self.commands) > 0:
      return self.commands.pop()

  def run(self):
    while True:
      try:
        line = raw_input(COMMAND_PROMPT)
        #line = sys.stdin.readline()
        if line:
          line = line.strip()
          space = line.find(' ')
          argstr = None
          tool = None

          if space == -1:
            command = line
          else:
            command = line[:space].strip()
            argstr = line[space:].strip()

          if "::" in command:
            ci = command.find("::")
            tool = command[:ci]
            command = command[ci+2:]

          if command in Commands:
            if command == "entercontext":
              self.current_context = argstr
              print "Entering context: " + self.current_context + "\n"
            else:
              args = {}
              if argstr:
                try:
                  args = json.loads(argstr)
                except ValueError:
                  print "Failed to parse arguments."
              self.commands.append(Command(self.current_context, command, tool, arguments=args))
          elif command:
            print "Unknown command: " + command
      except (ValueError, EOFError):
        break
    quit()


if __name__ == "__main__":
  client = None
  commandLine = None

  def main():
    global client
    global commandLine
    global currentContext

    host = None
    port = None
    execCommand = None
    execArgs = None
    execTool = None
    interactive = False

    (options, args) = parser.parse_args()

    if options.serverPort:
      port = options.serverPort

    if options.serverHost:
      host = options.serverHost

    if options.execCommand:
      execCommand = options.execCommand
      execArgs = options.execArgs
      execTool = options.execTool

    arglen = len(args)

    if arglen == 1:
      host = socket.gethostname()
      if port == None:
        port = args[0]
      elif execCommand == None:
        execCommand = args[0]
      elif execArgs == None:
        execArgs = args[0]
    elif arglen > 1:
      host = args[0]
      if port == None:
        port = args[1]
      elif execCommand == None:
        execCommand = args[1]
      elif execArgs == None:
        execArgs = args[1]

    if arglen > 2:
      if host == None:
        host = args[0]
      if port == None:
        port = args[1]
      if execCommand == None:
        execCommand = args[2]
      if arglen > 3 and execArgs == None:
        execArgs = args[3]

    # if we have no command to execute default to interactive mode
    if options.interactive or (execCommand == None):
      interactive = True

    if execArgs != None:
      try:
        execArgs = json.loads(execArgs)
      except ValueError:
        print "Failed to parse arguments."
        quit()

    if host and port:
      print 'Starting Crossfire client on ' + host + ':' + str(port)
      client = CrossfireClient(host, int(port))
      if interactive:
        commandLine = CommandLine()

      try:
        client.start()
        if interactive:
          commandLine.start()

        #print "Sending version command...\n"
        #command = Command("", "version")
        #client.sendPacket(command)

        print "Listing contexts...\n"
        command = Command("", "listcontexts")
        client.sendPacket(command)

        sendExecCommand = True

        while True:
            packet = client.getPacket()
            if packet:
              print
              json.dump(packet, sys.stdout, sort_keys=True, indent=2)
              print "\n" + COMMAND_PROMPT,

              #XXXmcollins: this makes the interactive mode work better on linux
              # but it fails on Windows with pyreadline.
              #readline.redisplay()

              ### try to set current context and/or look for 'closed' event
              if 'event' in packet:
                if packet['event'] == "closed":
                  quit()
                elif (packet['event'] == "onContextCreated") or (packet['event'] == "onContextLoaded"):
                  update_current_context(packet['context_id'])
                elif packet['event'] == "onContextChanged":
                  update_current_context(packet['new_context_id'])
              elif 'command' in packet:
                if packet['command'] == "listcontexts":
                  for ctx in packet['body']['contexts']:
                    if ctx['current'] == True:
                      update_current_context(ctx['context_id'])
                      break

                ### if we had a commmand to execute, send it here
                ### if we got a response to the command, quit here
                if execCommand:
                  if packet['command'] == execCommand and not interactive:
                    quit()
                  elif sendExecCommand == True:
                    command = Command(currentContext, execCommand, execTool, arguments=execArgs)
                    client.sendPacket(command)
                    sendExecCommand = False

            ### read in next command
            if interactive:
              command = commandLine.getCommand()
              if command:
                  print "\nSending command => " + command.command
                  client.sendPacket(command)

      except (KeyboardInterrupt):
        pass
    else:
      print 'No host and/or port specified.'
      print 'Usage: $> python crossfire_test_client.py [<host>] <port>'

    quit()

  def update_current_context(ctx):
    global currentContext
    global commandLine

    currentContext = ctx
    print "\nSet current context to: " + currentContext
    if commandLine != None:
      commandLine.setContext(ctx)
    return ctx

  def quit():
    global client
    global commandLine

    print "\nShutting down..."

    try:
      client.stop()
    except Exception:
      pass

    print "Stopped."

    try:
      sys.stdin.flush()
      sys.stdin.close()
      sys.stdout.close()
      commandLine.join(1)

    except Exception:
      sys.exit(1)
    sys.exit(0)

# kickstart
  main()
